import assert from 'node:assert/strict'
import test from 'node:test'
import { WalletPasskeys, PASSKEY_STORE_KEY, passkeyError } from '../src/controllers/wallet-passkeys.js'

const encoder = new TextEncoder()
const password = 'fixture-only-wallet-password-🔑'
const origin = 'https://wallet.example.test'
const b64 = value => Buffer.from(value).toString('base64url')

// Synthetic authenticator only. Real AES-GCM/HKDF operations are not mocked.
async function fixture() {
  const id = crypto.getRandomValues(new Uint8Array(32))
  const secret = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const values = new Map([['identity', JSON.stringify({ multiWIF: 'fixture-encrypted-identity', walletId: 'unchanged' })], ['accounts', 'fixture-accounts']])
  const store = { has: async key => values.has(key), get: async key => encoder.encode(values.get(key)),
    put: async (key, value) => values.set(key, value), delete: async key => values.delete(key) }
  const requests = [], state = { modify: credential => credential, beforeGet: async () => {}, createError: null }
  const credentials = {
    create: async options => {
      requests.push(['create', options])
      if (state.createError) throw state.createError
      // No PRF on create: enrollment must prove support through get().
      return { type: 'public-key', id: b64(id), rawId: id.buffer, getClientExtensionResults: () => ({}) }
    },
    get: async options => {
      requests.push(['get', options]); await state.beforeGet()
      const data = new Uint8Array(37)
      data.set(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(options.publicKey.rpId))))
      data[32] = 5
      const output = await crypto.subtle.sign('HMAC', secret, options.publicKey.extensions.prf.eval.first)
      return state.modify({ type: 'public-key', id: b64(id), rawId: id.buffer,
        response: { authenticatorData: data.buffer, clientDataJSON: encoder.encode(JSON.stringify({
          type: 'webauthn.get', challenge: b64(options.publicKey.challenge), origin, crossOrigin: false
        })) }, getClientExtensionResults: () => ({ prf: { results: { first: output } } }) })
    }
  }
  const options = { store, credentials, crypto, origin, secure: true, publicKeyCredential: class {}, locks: null,
    verifyPassword: async candidate => assert.equal(candidate, password, 'Incorrect wallet password') }
  return { api: new WalletPasskeys(options), options, values, requests, state }
}

test('enrolls only after verified get + PRF, encrypts locally and unlocks the original password after reload', async () => {
  const f = await fixture(), original = new Map(f.values)
  assert.deepEqual(await f.api.status(), { configured: false, enabled: false, reason: '' })
  await f.api.enable(password)
  assert.equal((await f.api.status()).enabled, true)
  const raw = f.values.get(PASSKEY_STORE_KEY), record = JSON.parse(raw)
  assert.equal(raw.includes(password), false)
  assert.equal(raw.includes('fixture-encrypted-identity'), false)
  assert.equal(record.version, 1)
  assert.equal(Buffer.from(record.iv, 'base64url').length, 12)
  const unlocked = await new WalletPasskeys(f.options).unlock()
  assert.equal(unlocked.password, password)
  assert.equal(unlocked.walletHash, record.walletHash)
  for (const [name, value] of original) assert.equal(f.values.get(name), value)
  assert.equal(f.values.size, original.size + 1)
  assert.deepEqual(f.requests.map(([type]) => type), ['create', 'get', 'get'])
  for (const [type, request] of f.requests) {
    assert.equal(request.publicKey.timeout, 60000)
    assert.equal(type === 'get' ? request.publicKey.userVerification : request.publicKey.authenticatorSelection.userVerification, 'required')
  }
  assert.notDeepEqual(f.requests[1][1].publicKey.challenge, f.requests[2][1].publicKey.challenge)
  assert.equal('password' in record, false)
})

test('a wrong password never creates a credential or writes an unlock record', async () => {
  const f = await fixture()
  await assert.rejects(f.api.enable('wrong-password'), /Incorrect wallet password/)
  assert.equal(f.requests.length, 0)
  assert.equal(f.values.has(PASSKEY_STORE_KEY), false)
})

test('enrollment without password verification is forbidden', async () => {
  const f = await fixture()
  await assert.rejects(new WalletPasskeys({ ...f.options, verifyPassword: undefined }).enable(password), /verification is required/)
  assert.equal(f.requests.length, 0)
})

test('passkey enrollment rejects IP origins before asking the authenticator, while localhost remains supported', async () => {
  const f = await fixture()
  for (const origin of ['https://127.0.0.1', 'http://127.0.0.1', 'https://[::1]', 'http://wallet.example.test']) {
    const api = new WalletPasskeys({ ...f.options, origin })
    assert.match(api.unavailableReason, /domain name/)
    await assert.rejects(api.enable(password), /domain name/)
  }
  assert.equal(f.requests.length, 0)
  assert.equal(new WalletPasskeys({ ...f.options, origin: 'http://localhost:9556' }).unavailableReason, '')
})

const corruptClient = (credential, change) => {
  const data = JSON.parse(new TextDecoder().decode(credential.response.clientDataJSON))
  credential.response.clientDataJSON = encoder.encode(JSON.stringify({ ...data, ...change }))
  return credential
}
for (const [name, modify] of Object.entries({
  'absent PRF': c => ({ ...c, getClientExtensionResults: () => ({ prf: {} }) }),
  'invalid PRF': c => ({ ...c, getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array(31) } } }) }),
  'no user verification': c => { new Uint8Array(c.response.authenticatorData)[32] = 1; return c },
  'no user presence': c => { new Uint8Array(c.response.authenticatorData)[32] = 4; return c },
  'other RP': c => { new Uint8Array(c.response.authenticatorData)[0] ^= 1; return c },
  'short authenticator data': c => { c.response.authenticatorData = new Uint8Array(2); return c },
  'other origin': c => corruptClient(c, { origin: 'https://evil.example.test' }),
  'cross-origin assertion': c => corruptClient(c, { crossOrigin: true }),
  'replayed challenge': c => corruptClient(c, { challenge: 'old' }),
  'wrong ceremony': c => corruptClient(c, { type: 'webauthn.create' }),
  'wrong credential': c => ({ ...c, id: 'different-credential' }),
  'mismatched raw ID': c => ({ ...c, rawId: new Uint8Array(32) })
})) {
  test(`rejects ${name} during enrollment and unlock without falling back to plaintext`, async () => {
    const f = await fixture()
    f.state.modify = modify
    await assert.rejects(f.api.enable(password))
    assert.equal(f.values.has(PASSKEY_STORE_KEY), false)
    f.state.modify = c => c
    await f.api.enable(password)
    const saved = f.values.get(PASSKEY_STORE_KEY)
    f.state.modify = modify
    await assert.rejects(f.api.unlock())
    assert.equal(f.values.get(PASSKEY_STORE_KEY), saved)
  })
}

test('unsupported contexts and cancellation preserve password-based recovery', async () => {
  const f = await fixture(), original = new Map(f.values)
  for (const changes of [{ secure: false }, { publicKeyCredential: null }, { credentials: {} }]) {
    const api = new WalletPasskeys({ ...f.options, ...changes })
    assert.ok((await api.status()).reason)
    await assert.rejects(api.enable(password), /unavailable/)
  }
  f.state.createError = new DOMException('cancelled', 'NotAllowedError')
  await assert.rejects(f.api.enable(password), { name: 'NotAllowedError' })
  assert.deepEqual(f.values, original)
  assert.match(passkeyError(f.state.createError), /cancelled or timed out/)
  const abort = new AbortController(); abort.abort()
  await assert.rejects(f.api.enable(password, { signal: abort.signal }), { name: 'AbortError' })
  assert.deepEqual(f.values, original)
})

test('the envelope is bound to this identity, site and authenticated metadata', async () => {
  const f = await fixture(); await f.api.enable(password)
  const saved = f.values.get(PASSKEY_STORE_KEY), identity = f.values.get('identity')
  f.values.set('identity', JSON.stringify({ multiWIF: 'other-wallet' }))
  assert.equal((await f.api.status()).enabled, false)
  const count = f.requests.length
  await assert.rejects(f.api.unlock(), /different wallet/)
  assert.equal(f.requests.length, count, 'no biometric prompt for another wallet')
  f.values.set('identity', identity)
  await assert.rejects(new WalletPasskeys({ ...f.options, origin: 'https://other.example.test' }).unlock(), /another site/)
  for (const field of ['ciphertext', 'iv', 'salt']) {
    const record = JSON.parse(saved), data = Buffer.from(record[field], 'base64url'); data[0] ^= 1
    record[field] = data.toString('base64url'); f.values.set(PASSKEY_STORE_KEY, JSON.stringify(record))
    await assert.rejects(f.api.unlock(), /Could not decrypt/)
  }
  f.values.set(PASSKEY_STORE_KEY, saved)
  assert.equal((await f.api.unlock()).password, password)
})

test('replacing wallet data or removing enrollment during a prompt cannot unlock a stale session', async () => {
  const f = await fixture(); await f.api.enable(password)
  const saved = f.values.get(PASSKEY_STORE_KEY), identity = f.values.get('identity')
  f.state.beforeGet = async () => f.values.delete(PASSKEY_STORE_KEY)
  await assert.rejects(f.api.unlock(), /settings changed/)
  f.values.set(PASSKEY_STORE_KEY, saved)
  f.state.beforeGet = async () => f.values.set('identity', JSON.stringify({ multiWIF: 'replaced' }))
  await assert.rejects(f.api.unlock(), /settings changed/)
  f.values.set('identity', identity)
  f.state.beforeGet = async () => f.values.set('identity', JSON.stringify({ multiWIF: 'replaced-again' }))
  await assert.rejects(f.api.enable(password), /settings changed/)
  assert.equal(f.values.get(PASSKEY_STORE_KEY), saved, 'failed enrollment does not overwrite previous enrollment')
})

test('removal and malformed saved records never remove the wallet or accounts', async () => {
  const f = await fixture(); await f.api.enable(password)
  const originals = [f.values.get('identity'), f.values.get('accounts')]
  for (const bad of ['{', JSON.stringify({ version: 99 }), 'x'.repeat(16001)]) {
    f.values.set(PASSKEY_STORE_KEY, bad)
    assert.equal((await f.api.status()).enabled, false)
    await assert.rejects(f.api.unlock())
  }
  await f.api.remove(); await f.api.remove()
  assert.equal(f.values.has(PASSKEY_STORE_KEY), false)
  assert.deepEqual([f.values.get('identity'), f.values.get('accounts')], originals)
})

test('an aborted authentication never returns a password', async () => {
  const f = await fixture(); await f.api.enable(password)
  const abort = new AbortController()
  f.state.beforeGet = async () => abort.abort()
  await assert.rejects(f.api.unlock({ signal: abort.signal }), { name: 'AbortError' })
})
