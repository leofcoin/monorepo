import assert from 'node:assert/strict'
import test from 'node:test'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { checkChainPresence } from '../dist/presence.js'

const identity = await createChainIdentity('peach', {
  contractFactory: 'A'.repeat(52), nativeToken: 'B'.repeat(52),
  nameService: 'C'.repeat(52), validators: 'D'.repeat(52)
})

test('offline checks do not request a node', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Must stay offline') })
  assert.deepEqual(await checkChainPresence('', identity.chainId), { status: 'unknown' })
})

test('endpoint checks verify genesis identity and use bounded credential-free requests', async t => {
  const request = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(identity)))
  assert.deepEqual(await checkChainPresence('http://localhost:3030/api/', identity.chainId), { status: 'found' })
  const [url, options] = request.mock.calls[0].arguments
  assert.equal(url.href, 'http://localhost:3030/api/chainIdentity')
  assert.equal(options.credentials, 'omit')
  assert.equal(options.redirect, 'error')
  assert.ok(options.signal instanceof AbortSignal)
  assert.deepEqual(await checkChainPresence('http://localhost:3030', `lfc:${'f'.repeat(64)}`), { status: 'not-observed' })
})

test('invalid URLs and chain IDs fail before making requests', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Must not request') })
  for (const url of ['file:///tmp/test', 'https://user:pass@example.org', 'https://example.org?secret=value']) {
    await assert.rejects(checkChainPresence(url, identity.chainId), /HTTP\(S\)/)
  }
  await assert.rejects(checkChainPresence('localhost', identity.chainId), /Invalid URL/)
  await assert.rejects(checkChainPresence('', 'invalid'), /Invalid chain ID/)
})

test('HTTP failures and forged identities fail explicitly, never report absence', async t => {
  const request = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }))
  await assert.rejects(checkChainPresence('http://localhost', identity.chainId), /HTTP 503/)
  request.mock.mockImplementation(async () => new Response(JSON.stringify({ ...identity, chainId: `lfc:${'f'.repeat(64)}` })))
  await assert.rejects(checkChainPresence('http://localhost', identity.chainId), /does not match/)
  request.mock.mockImplementation(async () => { throw new Error('Network unavailable') })
  await assert.rejects(checkChainPresence('http://localhost', identity.chainId), /Network unavailable/)
})

test('identity requests use a three-second abort signal and propagate timeouts', async t => {
  t.mock.method(AbortSignal, 'timeout', milliseconds => {
    assert.equal(milliseconds, 3000)
    return AbortSignal.abort(new DOMException('Node identity request timed out', 'TimeoutError'))
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    options.signal.throwIfAborted()
    throw new Error('An aborted identity request must not complete')
  })
  await assert.rejects(checkChainPresence('http://localhost', identity.chainId), { name: 'TimeoutError' })
})
