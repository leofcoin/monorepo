import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { PqIdentity, PQ_NETWORK, createPqGenesis } from '../../exports/browser/pq.js'
import BrowserNode from '../../exports/browser/node-browser.js'
import { verifyPqDigest } from '@leofcoin/lib/pq'

test('browser-bundled provider/builders share the launcher contract and reject repeated initialization', async t => {
  const keys = ['Peernet', 'localStorage', 'navigator']
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const entries = new Map()
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value)
  } })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    locks: { request: async (_key, _options, callback) => callback() }
  } })
  const identity = new PqIdentity(randomBytes(64))
  t.after(() => identity.destroy())
  const genesis = await createPqGenesis({ creator: identity.selectedAccount, target: '100', initial: '100',
    allocations: [{ address: identity.selectedAccount, amount: '100' }] })
  let reached = false
  globalThis.Peernet = class {
    static discoveryProtocolVersion = 3
    constructor(options) {
      reached = true
      assert.equal(options.identity, identity)
      assert.equal(Object.hasOwn(options, 'genesis'), false)
      assert.deepEqual(options.stars, [])
      assert.equal(options.chainId, genesis.chainId)
      throw new Error('provider seam reached; no browser transport opened')
    }
  }
  const config = { network: PQ_NETWORK, identity, genesis, autoStart: false }
  await assert.rejects(new BrowserNode(config), /provider seam reached/)
  assert.equal(reached, true)
  const digest = randomBytes(32)
  assert.equal(verifyPqDigest(identity.selectedAccount, await identity.sign(digest), digest, genesis.chainId), true)
  await assert.rejects(new BrowserNode(config), /realm already reserved/)
})
