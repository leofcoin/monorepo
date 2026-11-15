import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { PqIdentity, PQ_NETWORK } from '@leofcoin/lib/pq'
import { createPqGenesis } from '@leofcoin/lib/pq-genesis'
import { reserveNode, reserveChain } from '../../src/pq-runtime.ts'

test('PQ realm refuses classical providers, existing stores, mismatched and repeated initialization', async t => {
  const identity = new PqIdentity(randomBytes(64))
  t.after(() => { identity.destroy(); delete globalThis.peernet; delete globalThis.walletStore })
  const genesis = await createPqGenesis({ creator: identity.selectedAccount, target: '100', initial: '100',
    allocations: [{ address: identity.selectedAccount, amount: '100' }] })
  const config = { network: PQ_NETWORK, genesis, identity }
  assert.throws(() => reserveNode({ ...config, identity: { selectedAccount: 'classical' } }), /explicit PQ identity provider/)
  assert.throws(() => reserveNode({ network: 'leofcoin', identity }), /forbidden/)
  const prebound = new PqIdentity(randomBytes(64))
  const otherChain = 'lfc:' + 'ff'.repeat(32)
  prebound.bindChainId(otherChain === genesis.chainId ? 'lfc:' + 'ee'.repeat(32) : otherChain)
  assert.throws(() => reserveNode({ ...config, identity: prebound }), /another chain/)
  prebound.destroy()
  globalThis.walletStore = {}
  assert.throws(() => reserveNode(config), /not empty/)
  delete globalThis.walletStore
  const compatibleProvider = {
    network: identity.network,
    scheme: identity.scheme,
    id: identity.id,
    selectedAccount: identity.selectedAccount,
    bindChainId: chainId => identity.bindChainId(chainId),
    sign: digest => identity.sign(digest)
  }
  reserveNode({ ...config, identity: compatibleProvider })
  assert.throws(() => reserveNode(config), /already reserved/)
  assert.throws(() => reserveNode({ network: 'leofcoin' }), /already reserved/)
  assert.throws(() => reserveChain(PQ_NETWORK, genesis), /initialized/)
  globalThis.peernet = { ledgerNetwork: PQ_NETWORK, pqGenesis: genesis }
  reserveChain(PQ_NETWORK, genesis)
  assert.throws(() => reserveChain(PQ_NETWORK, genesis), /unused/)
  assert.throws(() => reserveChain('leofcoin'), /Classical chain forbidden/)
})
