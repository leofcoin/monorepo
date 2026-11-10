import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join, relative } from 'node:path'
import { startNode } from '@leofcoin/launch-chain/node'
import addresses from '@leofcoin/addresses'
import Peernet from '@leofcoin/peernet'
import Swarm from '@netpeer/swarm/client'

assert.equal(Peernet.discoveryProtocolVersion,3,'packed launcher must use app-ID Peernet')
assert.equal(Swarm.discoveryProtocolVersion,3,'packed launcher must use app-ID Swarm')

const root = join(process.cwd(), 'isolated-peach')
const node = await startNode({
  root: relative(homedir(), root),
  password: 'isolated-package-test-only',
  stars: [],
  httpPort: false,
  wsPort: false
})
assert.equal(globalThis.walletStore.db.root, root)
assert.ok(node.account)
assert.deepEqual(node.endpoints, { http: [], ws: [] })
const validators = await node.chain.staticCall(addresses.validators, 'validators')
assert.ok(Array.isArray(validators), 'real genesis validators contract must be ready')
assert.ok(validators.length > 0, 'the real genesis must have its configured validator')
assert.equal(BigInt((await node.chain.lastBlock).index), -1n)
assert.equal((await node.chain.getChainIdentity()).chainId,globalThis.peernet.namespace.chainId)
assert.equal(globalThis.peernet.ledgerNetwork,'leofcoin:peach')
console.log('STANDALONE_LAUNCH_READY', validators.length)
// Network workers are long-lived. This subprocess owns only temporary stores.
process.exit(0)
