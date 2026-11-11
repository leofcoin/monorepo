// Local unlock only: PRF encrypts the existing wallet password, never a new account.
// No PRF output, plaintext password or signing key is persisted or shared with tabs.
export const PASSKEY_STORE_KEY = 'passkey-unlock-v1'
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
const fail = message => { throw new Error(message) }
const bytes = value => value instanceof ArrayBuffer ? new Uint8Array(value) :
  ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : fail('Invalid passkey response.')
const encode = value => btoa(String.fromCharCode(...bytes(value))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const decode = (value, min, max = min) => {
  if (typeof value !== 'string' || value.length > Math.ceil(max * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(value)) fail('Invalid saved passkey. Remove it and enroll again with your password.')
  const result = Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
  if (result.length < min || result.length > max || encode(result) !== value) fail('Invalid saved passkey. Remove it and enroll again with your password.')
  return result
}
const cancelled = signal => { if (signal?.aborted) throw new DOMException('Passkey operation cancelled.', 'AbortError') }

export async function walletIdentityFingerprint(identity, crypto = globalThis.crypto) {
  if (!identity || typeof identity.multiWIF !== 'string') fail('Create or import a wallet first.')
  return encode(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(identity))))
}

export function passkeyError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') return 'Passkey cancelled or timed out. You can still use your wallet password.'
  if (error?.name === 'NotSupportedError') return 'This passkey cannot encrypt the wallet. Use your password or try another supported passkey.'
  if (error?.name === 'SecurityError') return 'Passkeys require the same trusted HTTPS site where they were enabled.'
  return error instanceof Error ? error.message : 'Passkey unlock failed. Use your wallet password.'
}

export class WalletPasskeys {
  constructor({ store, credentials = globalThis.navigator?.credentials, crypto = globalThis.crypto,
    origin = globalThis.location?.origin, secure = globalThis.isSecureContext,
    publicKeyCredential = globalThis.PublicKeyCredential, locks = globalThis.navigator?.locks,
    verifyPassword } = {}) {
    Object.assign(this, { store, credentials, crypto, origin, secure, publicKeyCredential, locks, verifyPassword })
  }
  get unavailableReason() {
    if (!this.secure || !this.origin || !this.publicKeyCredential || !this.crypto?.subtle ||
      !this.credentials?.create || !this.credentials?.get) return 'Passkey unlock is unavailable here. Use HTTPS and a browser with passkey support.'
    let url
    try { url = new URL(this.origin) } catch { return 'Passkeys require a trusted HTTPS domain, or localhost for development.' }
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) ||
      /^\d+(\.\d+){3}$/.test(url.hostname) || url.hostname.includes(':') || !url.hostname)
      return 'Passkeys require a domain name, not an IP address. For local development, open this site using localhost.'
    return ''
  }
  #store() {
    const store = this.store ?? globalThis.walletStore
    if (!store) fail('Load your wallet before configuring passkeys.')
    return store
  }
  async #read(store, key) {
    if (!await store.has(key)) return null
    const value = await store.get(key)
    const text = typeof value === 'string' ? value : decoder.decode(bytes(value))
    if (text.length > 16000) fail('Invalid saved passkey data.')
    return text
  }
  async #walletHash(store) {
    const identity = await this.#read(store, 'identity')
    if (!identity) fail('Create or import a wallet first.')
    return walletIdentityFingerprint(JSON.parse(identity), this.crypto)
  }
  #record(text) {
    let record
    try { record = JSON.parse(text) } catch { fail('Invalid saved passkey. Remove it and enroll again with your password.') }
    if (record?.version !== 1 || record.origin !== this.origin || record.rpId !== new URL(this.origin).hostname) fail('Saved passkey belongs to another site or format. Use your wallet password.')
    decode(record.walletHash, 32); decode(record.credentialId, 1, 1024)
    decode(record.salt, 32); decode(record.iv, 12); decode(record.ciphertext, 17, 4112)
    return record
  }
  async status() {
    const reason = this.unavailableReason
    let configured = false
    try {
      const store = this.#store()
      configured = await store.has(PASSKEY_STORE_KEY)
      const text = await this.#read(store, PASSKEY_STORE_KEY)
      if (!text) return { configured: false, enabled: false, reason }
      configured = true
      const record = this.#record(text)
      if (record.walletHash !== await this.#walletHash(store)) return { configured: true, enabled: false, reason: 'The saved passkey is for a different wallet. Remove it and enable one for this wallet.' }
      return { configured: true, enabled: !reason, reason }
    } catch (error) { return { configured, enabled: false, reason: passkeyError(error) } }
  }
  #exclusive(action) {
    return this.locks?.request ? this.locks.request('leofcoin:wallet-passkey', action) : action()
  }
  #random(length) { return this.crypto.getRandomValues(new Uint8Array(length)) }
  #requireAvailable() { if (this.unavailableReason) fail(this.unavailableReason) }
  async #assertion(record, signal) {
    cancelled(signal)
    const challenge = this.#random(32)
    const credential = await this.credentials.get({ signal, publicKey: {
      challenge, rpId: record.rpId, timeout: 60000, userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: decode(record.credentialId, 1, 1024) }],
      extensions: { prf: { eval: { first: decode(record.salt, 32) } } }
    } })
    cancelled(signal)
    if (credential?.type !== 'public-key' || encode(credential.rawId) !== record.credentialId || credential.id !== record.credentialId) fail('Unexpected passkey. Use the passkey enabled for this wallet.')
    const client = JSON.parse(decoder.decode(bytes(credential.response.clientDataJSON)))
    if (client.type !== 'webauthn.get' || client.challenge !== encode(challenge) || client.origin !== this.origin || client.crossOrigin === true) fail('Invalid passkey verification context.')
    const auth = bytes(credential.response.authenticatorData)
    const rpHash = new Uint8Array(await this.crypto.subtle.digest('SHA-256', encoder.encode(record.rpId)))
    if (auth.length < 37 || !(auth[32] & 1) || !(auth[32] & 4) || !rpHash.every((b, i) => b === auth[i])) fail('Passkey requires verified user presence on this site.')
    const output = credential.getClientExtensionResults()?.prf?.results?.first
    if (!output || bytes(output).length !== 32) fail('This passkey does not support wallet encryption (PRF). Your wallet password still works.')
    return bytes(output)
  }
  #aad(record) {
    return encoder.encode(JSON.stringify([record.version, record.origin, record.rpId, record.walletHash, record.credentialId, record.salt]))
  }
  async #key(output, record, usages) {
    try {
      const material = await this.crypto.subtle.importKey('raw', output, 'HKDF', false, ['deriveKey'])
      return await this.crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: decode(record.salt, 32),
        info: encoder.encode('leofcoin/wallet-passkey/password-wrap/v1') }, material,
      { name: 'AES-GCM', length: 256 }, false, usages)
    } finally { output.fill(0) }
  }
  async enable(password, { signal } = {}) {
    this.#requireAvailable()
    if (typeof password !== 'string' || !password || encoder.encode(password).length > 4096) fail('Enter your current wallet password.')
    if (typeof this.verifyPassword !== 'function') fail('Wallet password verification is required.')
    return this.#exclusive(async () => {
      const store = this.#store(), walletHash = await this.#walletHash(store)
      const previous = await this.#read(store, PASSKEY_STORE_KEY)
      await this.verifyPassword(password)
      cancelled(signal)
      const rpId = new URL(this.origin).hostname
      const created = await this.credentials.create({ signal, publicKey: {
        challenge: this.#random(32), rp: { id: rpId, name: 'Leofcoin wallet' },
        user: { id: this.#random(32), name: 'Leofcoin wallet', displayName: 'Leofcoin wallet' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
        attestation: 'none', timeout: 60000, extensions: { prf: {} }
      } })
      cancelled(signal)
      if (created?.type !== 'public-key') fail('No passkey was created.')
      const credentialId = encode(created.rawId)
      if (created.id !== credentialId) fail('Invalid passkey response.')
      decode(credentialId, 1, 1024)
      const record = { version: 1, origin: this.origin, rpId, walletHash, credentialId, salt: encode(this.#random(32)) }
      // Always test get(), including PRF and UV, before persisting anything.
      const output = await this.#assertion(record, signal)
      const key = await this.#key(output, record, ['encrypt'])
      const iv = this.#random(12), plaintext = encoder.encode(password)
      let ciphertext
      try { ciphertext = await this.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this.#aad(record) }, key, plaintext) }
      finally { plaintext.fill(0) }
      cancelled(signal)
      if (walletHash !== await this.#walletHash(store) || previous !== await this.#read(store, PASSKEY_STORE_KEY)) fail('Wallet or passkey settings changed. Try again.')
      cancelled(signal)
      await store.put(PASSKEY_STORE_KEY, JSON.stringify({ ...record, iv: encode(iv), ciphertext: encode(ciphertext) }))
      return true
    })
  }
  async unlock({ signal } = {}) {
    this.#requireAvailable()
    return this.#exclusive(async () => {
      const store = this.#store(), text = await this.#read(store, PASSKEY_STORE_KEY)
      if (!text) fail('No passkey is enabled for this wallet. Use your wallet password.')
      const record = this.#record(text)
      if (record.walletHash !== await this.#walletHash(store)) fail('This passkey belongs to a different wallet. Use your wallet password.')
      const output = await this.#assertion(record, signal)
      const key = await this.#key(output, record, ['decrypt'])
      let plaintext
      try {
        plaintext = new Uint8Array(await this.crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(record.iv, 12), additionalData: this.#aad(record) }, key, decode(record.ciphertext, 17, 4112)))
        cancelled(signal)
        if (record.walletHash !== await this.#walletHash(store) || text !== await this.#read(store, PASSKEY_STORE_KEY)) fail('Wallet or passkey settings changed. Use your password.')
        cancelled(signal)
        return { password: decoder.decode(plaintext), walletHash: record.walletHash }
      } catch (error) {
        if (error?.name === 'OperationError') fail('Could not decrypt passkey unlock data. Use your wallet password and enable a passkey again.')
        throw error
      } finally { plaintext?.fill(0) }
    })
  }
  async remove() {
    return this.#exclusive(async () => {
      const store = this.#store()
      if (await store.has(PASSKEY_STORE_KEY)) await store.delete(PASSKEY_STORE_KEY)
    })
  }
}
