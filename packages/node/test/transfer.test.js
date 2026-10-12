import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareTransfer, submitTransfer, networkStatus } from '../src/controllers/transfer.js'

const account = 'YTqzdvFjFnk7uX3tA54GaS1FyJXuAqRgnWZESKAsY19FDDDnHRdSN'
const options = () => ({
  chain: {
    state: { sync: 'synced' },
    nativeToken: account,
    createTransaction: async (tx) => ({ ...tx, timestamp: Date.now(), nonce: 1 }),
    balanceOf: async () => 10n ** 20n
  },
  peernet: { connections: { a: { connected: true } } },
  identity: {
    signer: async (address) => {
      assert.equal(address, account)
      return { sign: async () => new Uint8Array(64) }
    }
  },
  from: account,
  to: account,
  amount: '1.25'
})
test('prepares the authenticated two-argument transfer with exact units and signed fee', async () => {
  const prepared = await prepareTransfer(options())
  assert.deepEqual(prepared.signed.params, [account, '1250000000000000000'])
  assert.equal(prepared.signed.from, account)
  assert.equal(prepared.amount, '1.25')
  assert.ok(BigInt(prepared.signed.nonce) > 0n)
  assert.ok(Number(prepared.fee) > 0)
})
test('blocks disconnected or unsynced nodes rather than trusting startup readiness', async () => {
  assert.equal(
    networkStatus({ state: { sync: 'connectionless' } }, { connections: { a: { connected: true } } }).ready,
    false
  )
  const o = options()
  o.peernet.connections = {}
  await assert.rejects(prepareTransfer(o), /connected and synced/)
})
test('rejects zero, negative, exponent and over-precise amounts and invalid recipients', async () => {
  for (const amount of ['0', '-1', '1e3', '0.1234567890123456789'])
    await assert.rejects(prepareTransfer({ ...options(), amount }))
  await assert.rejects(prepareTransfer({ ...options(), to: 'not-an-address' }), /valid Leofcoin address/)
})
test('requires enough balance for amount plus the signed transaction fee', async () => {
  const o = options()
  o.chain.balanceOf = async () => 1250000000000000000n
  await assert.rejects(prepareTransfer(o), /including the fee/)
})
test('stays pending until the canonical completion handle resolves', async () => {
  let resolve
  const wait = new Promise((r) => (resolve = r))
  const states = []
  const sending = submitTransfer({ sendTransaction: async () => ({ hash: 'tx', wait }) }, { signed: {} }, (s) =>
    states.push(s.phase)
  )
  await new Promise((r) => setImmediate(r))
  assert.deepEqual(states, ['submitting', 'pending'])
  resolve('tx')
  await sending
  assert.deepEqual(states, ['submitting', 'pending', 'confirmed'])
})
test('does not show confirmation for rejected execution or a missing completion handle', async () => {
  const states = []
  await assert.rejects(
    submitTransfer(
      { sendTransaction: async () => ({ hash: 'tx', wait: Promise.reject(new Error('execution failed')) }) },
      { signed: {} },
      (s) => states.push(s.phase)
    ),
    /execution failed/
  )
  assert.deepEqual(states, ['submitting', 'pending'])
  await assert.rejects(
    submitTransfer({ sendTransaction: async () => ({ hash: 'tx' }) }, { signed: {} }, () => {}),
    /confirmation handle/
  )
})
