// One node per OS process. Invoked only by pq.test.js with an explicit temporary root.
import assert from 'node:assert/strict'
import { homedir, tmpdir } from 'node:os'
import { relative, isAbsolute } from 'node:path'
import { realpath } from 'node:fs/promises'
import { PqIdentity, PQ_NETWORK } from '@leofcoin/lib/pq'
import { createPqGenesis } from '@leofcoin/lib/pq-genesis'
import { signTransaction } from '@leofcoin/lib'
import { BlockMessage } from '@leofcoin/messages'
import Node from '../exports/node.js'
import Chain from '../exports/chain.js'

const timeout = setTimeout(() => { console.error('PQ_RUNTIME_TIMEOUT'); process.exit(2) }, 25000)
try {
  const dataRoot = await realpath(process.env.LEOFCOIN_PQ_TEST_ROOT)
  const fromTemp = relative(await realpath(tmpdir()), dataRoot)
  assert.ok(fromTemp && !fromTemp.startsWith('..') && !isAbsolute(fromTemp))
  const seed = Uint8Array.from(Buffer.from(process.env.LEOFCOIN_PQ_TEST_SEED, 'hex'))
  delete process.env.LEOFCOIN_PQ_TEST_SEED
  const identity = new PqIdentity(seed), recipient = new PqIdentity(seed, PQ_NETWORK, 1)
  const wrongChainIdentity = new PqIdentity(seed)
  wrongChainIdentity.bindChainId('lfc:' + 'ab'.repeat(32))
  seed.fill(0)
  const conflict = process.argv.includes('conflict')
  const genesis = await createPqGenesis({
    creator: identity.selectedAccount, target: conflict ? '2000000000000000000000000' : '1000000000000000000000000',
    initial: '1000000000000000000000000',
    allocations: [{ address: identity.selectedAccount, amount: '1000000000000000000000000' }]
  })
  const config = { network: PQ_NETWORK, root: relative(homedir(), dataRoot), stars: [],
    autoStart: false, genesis, identity }
  await new Node(config).ready
  assert.equal(globalThis.peernet.identity, identity)
  assert.equal(globalThis.peernet.ledgerNetwork, PQ_NETWORK)
  assert.equal(globalThis.peernet.namespace.chainId, genesis.chainId)
  if (process.argv.includes('replay')) await globalThis.stateStore.clear()
  const badProof = process.argv.includes('bad-proof')
  if (badProof) {
    await globalThis.stateStore.clear()
    const tip = new TextDecoder().decode(await globalThis.chainStore.get('lastBlock'))
    const block = new BlockMessage(await globalThis.blockStore.get(tip))
    const corrupted = new BlockMessage({ ...block.decoded, producerProof: '1' })
    const hash = await corrupted.hash()
    await globalThis.blockStore.put(hash, corrupted.encoded)
    await globalThis.chainStore.put('lastBlock', hash)
  }
  const chain = new Chain(config)
  if (conflict) {
    await assert.rejects(chain.ready, /belongs to another genesis/)
    console.log('PQ_CONFLICT_REJECTED')
    process.exit(0)
  }
  if (badProof) {
    await assert.rejects(chain.ready, /invalid producerProof/)
    console.log('PQ_BAD_PROOF_REJECTED')
    process.exit(0)
  }
  assert.equal(await chain.ready, true)
  assert.equal((await chain.getChainIdentity()).chainId, genesis.chainId)
  assert.deepEqual(await chain.staticCall(genesis.addresses.validators, 'validators'), [identity.selectedAccount])
  assert.equal(chain.nativeToken, genesis.addresses.nativeToken)
  assert.equal((await chain.getChainIdentity()).genesisContracts.dexFactory, genesis.addresses.dexFactory)
  assert.deepEqual(await chain.staticCall(genesis.addresses.dexFactory, 'pools'), [])
  assert.equal(await chain.staticCall(genesis.addresses.dexFactory, 'creator'), identity.selectedAccount)
  if (process.argv.includes('create')) {
    await chain.participate(identity.selectedAccount)
    const raw = { from: identity.selectedAccount, to: genesis.addresses.nativeToken, method: 'transfer',
      params: [recipient.selectedAccount, 100n], nonce: 1, timestamp: 1000 }
    const signed = await signTransaction(raw, identity)
    await assert.rejects(chain.sendTransaction({ ...signed, params: [recipient.selectedAccount, 101n] }), /signature/)
    await assert.rejects(chain.sendTransaction({ ...signed, from: 'classical' }), /signature/)
    await assert.rejects(chain.sendTransaction(await signTransaction(raw, wrongChainIdentity)), /signature/)
    const pending = await chain.sendTransaction(signed)
    await pending.wait
    assert.equal(Number((await chain.lastBlock).index), 0)
  } else {
    assert.equal(Number((await chain.lastBlock).index), 0)
  }
  assert.equal(await chain.staticCall(genesis.addresses.nativeToken, 'balanceOf', [recipient.selectedAccount]), 100n)
  // Repeated nodes/chains must fail without replacing globals or opening a second root.
  const peer = globalThis.peernet
  await assert.rejects(new Node(config).ready, /realm already reserved/)
  assert.throws(() => new Chain(config), /unused PQ node realm/)
  assert.equal(globalThis.peernet, peer)
  identity.destroy(); recipient.destroy(); wrongChainIdentity.destroy()
  console.log('PQ_RUNTIME_OK', process.argv[2])
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  clearTimeout(timeout)
  // All child workers/stores belong to this bounded disposable test process.
  process.exit(process.exitCode ?? 0)
}
