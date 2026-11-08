import assert from 'node:assert/strict'
import { realpath, readFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { relative, isAbsolute, join } from 'node:path'

// Isolate stores explicitly rather than changing HOME for the whole process.
if (!process.env.LEOFCOIN_SMOKE_DATA_ROOT) throw new Error('An explicit temporary smoke-test data root is required')
const dataRoot = await realpath(process.env.LEOFCOIN_SMOKE_DATA_ROOT)
const fromTemp = relative(await realpath(tmpdir()), dataRoot)
if (!fromTemp || fromTemp.startsWith('..') || isAbsolute(fromTemp)) throw new Error('Smoke-test root must be inside the temporary directory')
const root = relative(homedir(), dataRoot)
const { default: addresses } = await import('@leofcoin/addresses')
const { default: Node } = await import('../exports/node.js')
const node = new Node(
  {
    network: 'leofcoin:peach',
    networkVersion: 'peach',
    root,
    stars: [],
    autoStart: false
  },
  'operational-test'
)

await node.ready
const walletPeer = globalThis.peernet.identity.id
const account = globalThis.peernet.selectedAccount
assert.equal(globalThis.peernet.peerId, walletPeer)
assert.notEqual(globalThis.peernet.id, walletPeer)
assert.match(globalThis.peernet.id, /^lfc-peer-[a-f0-9]{32}$/)
assert.equal(await readFile(join(dataRoot, 'node-routing-id'), 'utf8'), globalThis.peernet.id)

// OPFS rejects deletion of an absent file, unlike LevelDB's no-op deletion.
// Exercise real chain startup with that stricter storage contract, too.
const deleteChainRecord = globalThis.chainStore.delete.bind(globalThis.chainStore)
globalThis.chainStore.delete = async key => {
  if (!await globalThis.chainStore.has(key)) throw new DOMException(`Missing chain record: ${key}`, 'NotFoundError')
  return deleteChainRecord(key)
}

const { default: Chain } = await import('../exports/chain.js')
const chain = new Chain({ network: 'leofcoin:peach', networkVersion: 'peach' })
const timeout = setTimeout(() => {
  console.error('CHAIN_READY_TIMEOUT')
  process.exit(2)
}, 20_000)

assert.equal(await chain.ready, true, 'chain.ready must complete successfully')
assert.equal(chain.loaded, true, 'chain must have finished loading')
assert.equal(chain.state.chain, 'loaded', 'chain state must be loaded')
clearTimeout(timeout)
assert.equal(globalThis.peernet.peerId, walletPeer, 'startup must preserve wallet identity')
assert.equal(globalThis.peernet.selectedAccount, account, 'startup must preserve the validator account')
const validators = await chain.staticCall(addresses.validators, 'validators')
if (!Array.isArray(validators)) throw new Error('validators contract was not ready with chain.ready')
const identity = await chain.getChainIdentity()
if (!/^lfc:[a-f0-9]{64}$/.test(identity.chainId)) throw new Error('chain identity unavailable')
const wrappedIdentity = await globalThis.peernet.requestProtos.chainIdentity()
if (wrappedIdentity.decoded.response.chainId !== identity.chainId) throw new Error('chain identity handler mismatch')
console.log('CHAIN_ID', identity.chainId)
console.log('MACHINE_READY', validators.length)
console.log('CHAIN_READY', chain.state, await chain.lastBlock)
process.exit(0)
