import assert from 'node:assert/strict'
import test from 'node:test'
import { BlockMessage } from '@leofcoin/messages'
import { CHECKPOINT_KEYS, readCheckpoint, writeCheckpoint, recoveryHistory, restoreAccountNonces } from '../../exports/state-checkpoint.js'

const chainId = `lfc:${'a'.repeat(64)}`
const required = ['token', 'validators', 'factory', 'names']
const snapshot = (index = -1) => ({ chainId, lastBlock: { index, hash: index < 0 ? '0x0' : `block-${index}` },
  states: Object.fromEntries(required.map(key => [key, { balances: { alice: 1000n } }])), accounts: { alice: '9007199254740993' },
  info: { nativeCalls: 0n, nativeMints: 0n, nativeBurns: 0n, nativeTransfers: 0n, totalBurnAmount: 0n,
    totalMintAmount: 0n, totalTransferAmount: 0n, totalTransactions: 0n, totalBlocks: BigInt(index + 1) } })
const store = () => {
  const values = new Map()
  return { values, has: async key => values.has(key), get: async key => values.get(key),
    keys: async () => [...values.keys()],
    put: async (key, value) => { values.set(key, value) }, clear: async () => values.clear() }
}

test('complete checkpoints round-trip all contract states, exact nonces and financial counters', async () => {
  const disk = store()
  const state = snapshot(0)
  state.states.custom = { nested: { big: 2n ** 100n } }
  await writeCheckpoint(disk, state, 0, required)
  assert.deepEqual(await readCheckpoint(disk, chainId, required), { generation: 0, snapshot: state })
  assert.deepEqual([...disk.values.keys()], [CHECKPOINT_KEYS[0]])
})

test('a crash before or during the next write preserves the preceding complete generation', async () => {
  for (const partial of [false, true]) {
    const disk = store()
    await writeCheckpoint(disk, snapshot(), 0, required)
    const put = disk.put
    disk.put = async (key, bytes) => {
      if (partial) await put(key, bytes.subarray(0, 40))
      throw new Error('simulated power loss')
    }
    await assert.rejects(writeCheckpoint(disk, snapshot(0), 1, required), /power loss/)
    assert.equal((await readCheckpoint(disk, chainId, required)).generation, 0)
  }
})

test('a committed slot survives a lost acknowledgement without being replayed twice', async () => {
  const disk = store()
  await writeCheckpoint(disk, snapshot(), 0, required)
  const put = disk.put
  disk.put = async (key, bytes) => { await put(key, bytes); throw new Error('acknowledgement lost') }
  await assert.rejects(writeCheckpoint(disk, snapshot(0), 1, required), /lost/)
  const restored = await readCheckpoint(disk, chainId, required)
  assert.equal(restored.generation, 1)
  assert.equal(restored.snapshot.lastBlock.index, 0)
})

test('alternating slots tolerate a torn overwrite but never accept both corrupt slots or another chain', async () => {
  const disk = store()
  await writeCheckpoint(disk, snapshot(), 0, required)
  await writeCheckpoint(disk, snapshot(0), 1, required)
  await disk.put(CHECKPOINT_KEYS[0], new TextEncoder().encode('{'))
  assert.equal((await readCheckpoint(disk, chainId, required)).generation, 1)
  await assert.rejects(readCheckpoint(disk, `lfc:${'b'.repeat(64)}`, required), /No valid state checkpoint/)
  await disk.put(CHECKPOINT_KEYS[1], new TextEncoder().encode('{}'))
  await assert.rejects(readCheckpoint(disk, chainId, required), /No valid state checkpoint/)
})

test('incomplete state, inconsistent block counters and invalid nonces never reach storage', async () => {
  for (const mutate of [state => delete state.states.token, state => state.info.totalBlocks = 9n,
    state => state.accounts.alice = '1.5', state => state.info.nativeBurns = -1n]) {
    const disk = store(), state = snapshot()
    mutate(state)
    await assert.rejects(writeCheckpoint(disk, state, 0, required))
    assert.equal(disk.values.size, 0)
  }
})

test('storage I/O errors are propagated instead of being treated as a missing or corrupt checkpoint', async () => {
  const disk = store()
  await writeCheckpoint(disk, snapshot(), 0, required)
  disk.get = async () => { throw new Error('disk read failed') }
  await assert.rejects(readCheckpoint(disk, chainId, required), /disk read failed/)
  disk.keys = async () => { throw new Error('inventory read failed') }
  await assert.rejects(readCheckpoint(disk, chainId, required), /inventory read failed/)
})

test('recovery hashes and links every block, rejecting missing content and broken ancestry', async () => {
  const bytes = new Map()
  let previousHash = '0x0'
  for (let index = 0; index < 3; index++) {
    const block = new BlockMessage({ index: BigInt(index), previousHash, timestamp: 100 + index,
      reward: 0n, fees: 0n, transactions: [], validators: [], producer: 'fixture', producerProof: 'fixture', protocolVersion: '0.4.0' })
    previousHash = await block.hash()
    bytes.set(previousHash, block.encoded)
  }
  const history = await recoveryHistory(previousHash, hash => bytes.get(hash))
  assert.deepEqual(history.map(block => block.index), [0n, 1n, 2n])
  assert.ok(history.every(block => block.loaded === false))
  const reads = []
  const suffix = await recoveryHistory(previousHash, hash => {
    reads.push(hash)
    return bytes.get(hash)
  }, history[0])
  assert.deepEqual(suffix.map(block => block.index), [1n, 2n])
  assert.deepEqual(reads, [history[2].hash, history[1].hash], 'anchored sync must not refetch committed ancestry')
  assert.deepEqual(await recoveryHistory(history[0].hash, () => assert.fail('duplicate tip must not fetch'), history[0]), [])
  await assert.rejects(recoveryHistory(previousHash, hash => bytes.get(hash), { index: 0, hash: 'other-genesis' }),
    /does not extend canonical tip/)
  await assert.rejects(recoveryHistory(previousHash, hash => bytes.get(hash), { index: 10, hash: history[0].hash }),
    /Invalid recovery chain link/)
  await assert.rejects(recoveryHistory(previousHash, () => { throw new Error('ancestry read failed') }, history[0]),
    /ancestry read failed/)
  await assert.rejects(recoveryHistory(previousHash, () => undefined), /unavailable/)
  await assert.rejects(recoveryHistory('wrong-hash', () => bytes.get(previousHash)), /hash mismatch/)
  const { hash: ignored, ...header } = history[2]
  const gap = new BlockMessage({ ...header, index: 5n })
  const gapHash = await gap.hash()
  await assert.rejects(recoveryHistory(gapHash, hash => hash === gapHash ? gap.encoded : bytes.get(hash)), /Unexpected block index/)
})

test('derived nonce restoration removes ahead-of-checkpoint values and is repeatable after interruption', async () => {
  const accounts = store()
  await accounts.put('alice', '99')
  await accounts.put('uncommitted', '100')
  const put = accounts.put
  accounts.put = async (key, value) => { await put(key, value); throw new Error('crash') }
  await assert.rejects(restoreAccountNonces(accounts, { alice: '5', bob: '6' }), /crash/)
  accounts.put = put
  await restoreAccountNonces(accounts, { alice: '5', bob: '6' })
  assert.deepEqual(Object.fromEntries(accounts.values), { alice: '5', bob: '6' })
})
