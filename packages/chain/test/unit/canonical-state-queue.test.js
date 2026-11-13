import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import LittlePubSub from '@vandeurenglenn/little-pubsub'
import { CanonicalStateQueue } from '../../src/consensus/canonical-state-queue.ts'
import { createApplicationHarness, deferred, methods } from '../helpers/canonical-state-harness.js'
import { createCanonicalTransactionWaiter } from '../../src/transaction-finalization.ts'

test('failing commit observers cannot poison the writer or skip later listeners', async t => {
  t.mock.method(console, 'warn', () => {})
  const fixture = createApplicationHarness(), bus = new LittlePubSub(), observed = []
  globalThis.pubsub = bus
  for (const topic of ['transaction-processed', 'block-processed']) {
    bus.subscribe(topic, () => {
      assert.equal(fixture.counts.snapshots, 1, 'observers run only after checkpoint persistence')
      throw new Error(`${topic} observer failed`)
    })
    bus.subscribe(topic, () => observed.push(topic))
  }
  await fixture.instance.add(fixture.block)
  await fixture.instance.add(fixture.block) // The queue must still accept a duplicate/no-op.
  assert.deepEqual(observed, ['transaction-processed', 'block-processed'])
  assert.equal(fixture.instance.loaded, true)
  assert.equal(fixture.counts.executions, 1)
  assert.equal(fixture.counts.rewards, 1)
})

test('failed checkpoint writes never emit transaction or block success notifications', async () => {
  const fixture = createApplicationHarness({ snapshotFailure: true }), bus = new LittlePubSub(), observed = []
  globalThis.pubsub = bus
  for (const topic of ['transaction-processed', 'account-transaction-processed', 'block-processed'])
    bus.subscribe(topic, () => observed.push(topic))
  await assert.rejects(fixture.instance.add(fixture.block), /snapshot write failed/)
  assert.deepEqual(observed, [])
})

test('a failed worker batch rejects transaction waiters and never announces a durable success', async () => {
  const fixture = createApplicationHarness({
    async execute() { throw Object.assign(new Error('execution failed'), { transactionHash: 'tx' }) }
  }), bus = new LittlePubSub(), observed = []
  globalThis.pubsub = bus
  let published = 0
  globalThis.peernet.publish = () => { published++; return new Promise(() => {}) }
  bus.subscribe('block-processed', () => observed.push('committed'))
  const waiter = createCanonicalTransactionWaiter(bus, globalThis.transactionPoolStore, 'tx')
  const failed = assert.rejects(waiter.wait, failure => failure.hash === 'tx' && /execution failed/.test(failure.error.message))
  await assert.rejects(fixture.instance.add(fixture.block), /execution failed/)
  await failed
  assert.deepEqual(observed, [])
  assert.equal(published, 1, 'failure gossip must not block waiter rejection or the canonical writer')
  assert.equal(fixture.counts.snapshots, 0)
})

test('durable commit clears a losing proposal at the committed height, not only an identical hash', async () => {
  const proposal = { index: 571, hash: 'losing-proposal', round: 2 }
  const fixture = createApplicationHarness({ proposal })
  await fixture.instance.add(fixture.block)
  assert.deepEqual(fixture.instance.consensusState, { proposal: null, round: 0 })
})

test('failed checkpoint does not claim proposal cleanup as a successful commit', async () => {
  const proposal = { index: 571, hash: 'losing-proposal', round: 2 }
  const fixture = createApplicationHarness({ proposal, snapshotFailure: true })
  await assert.rejects(fixture.instance.add(fixture.block), /snapshot write failed/)
  assert.equal(fixture.instance.consensusState.proposal, proposal)
})

test('sync progress and loaded-block observers cannot turn a successful recovery into an error', async t => {
  t.mock.method(console, 'warn', () => {})
  const fixture = createApplicationHarness(), bus = new LittlePubSub(), observed = []
  globalThis.pubsub = bus
  for (const topic of ['sync-progress', 'block-loaded']) {
    bus.subscribe(topic, () => { throw new Error(`${topic} observer failed`) })
    bus.subscribe(topic, () => observed.push(topic))
  }
  assert.equal(await fixture.instance.sync(), 'synced')
  await fixture.instance.add(fixture.block)
  assert.deepEqual(observed, ['sync-progress', 'block-loaded', 'sync-progress'])
  assert.equal(fixture.counts.executions, 1)
})

test('locally available transaction bodies are executed, not mistaken for canonical commits', async () => {
  const fixture = createApplicationHarness()
  fixture.transactions.add('tx')
  await fixture.instance.add(fixture.block)
  assert.equal(fixture.counts.executions, 1)
  assert.deepEqual(fixture.balances, { sender: 890n, recipient: 100n, validator: 110n })
})

test('a committed sender nonce rejects a repeated transaction before another transfer or fee', async () => {
  const fixture = createApplicationHarness()
  fixture.accountNonces.set('sender', new TextEncoder().encode('1'))
  await assert.rejects(fixture.instance.add(fixture.block), /nonce out of sequence/)
  assert.equal(fixture.counts.executions, 0)
  assert.equal(fixture.counts.fees, 0)
  assert.equal(fixture.counts.rewards, 0)
})

test('concurrent duplicate commits execute transactions, fees and rewards exactly once', async () => {
  const gate = deferred()
  const entered = deferred()
  const fixture = createApplicationHarness({ execute: async () => { entered.resolve(); await gate.promise } })
  const first = fixture.instance.add(fixture.block)
  await entered.promise
  const duplicates = Array.from({ length: 12 }, () => fixture.instance.add(fixture.block))
  gate.resolve()
  await Promise.all([first, ...duplicates])
  assert.deepEqual(fixture.counts, { executions: 1, fees: 1, rewards: 1, loaded: 1, snapshots: 1, stores: 1 })
  assert.deepEqual(fixture.balances, { sender: 890n, recipient: 100n, validator: 110n })
  assert.equal(fixture.events.filter(event => event === 'added block: block').length, 1)
  assert.ok(fixture.events.indexOf('added block: block') > fixture.events.indexOf('snapshot'))
  assert.deepEqual(fixture.block.decoded.transactions, ['tx'])
  assert.equal(fixture.block.decoded.fees, 10n)
})

test('different blocks at the same height cannot both mutate state', async () => {
  const fixture = createApplicationHarness()
  const results = await Promise.allSettled([
    fixture.instance.add(fixture.block), fixture.instance.add(fixture.fork())
  ])
  assert.equal(results[0].status, 'fulfilled')
  assert.equal(results[1].status, 'rejected')
  assert.match(results[1].reason.message, /Block conflict/)
  assert.equal(fixture.counts.executions, 1)
  assert.equal(fixture.counts.rewards, 1)
})

for (const first of ['sync', 'gossip']) {
  test(`${first} and the other application route share the same writer`, async () => {
    const fixture = createApplicationHarness()
    const sync = () => fixture.instance.sync(fixture.loadedBlock())
    const gossip = () => fixture.instance.add(fixture.block)
    await Promise.all(first === 'sync' ? [sync(), gossip()] : [gossip(), sync()])
    assert.equal(fixture.counts.executions, 1)
    assert.equal(fixture.counts.fees, 1)
    assert.equal(fixture.counts.rewards, 1)
    assert.equal(fixture.counts.loaded, 1)
    assert.deepEqual(fixture.balances, { sender: 890n, recipient: 100n, validator: 110n })
  })
}

test('a validation failure does not prevent a subsequent valid block', async () => {
  const fixture = createApplicationHarness({ invalid: true })
  await assert.rejects(fixture.instance.add(fixture.block), /invalid block/)
  assert.equal(fixture.counts.stores, 0)
  fixture.options.invalid = false
  await fixture.instance.add(fixture.block)
  assert.equal(fixture.counts.rewards, 1)
})

test('unrelated inventory entries do not block canonical target catch-up', async () => {
  const fixture = createApplicationHarness()
  fixture.instance.wantList.push('unavailable-orphan-block')
  assert.equal(await fixture.instance.sync(), 'synced')
  assert.equal(fixture.counts.loaded, 1)
  assert.equal(fixture.counts.executions, 1)
})

for (const failure of ['rewardFailure', 'snapshotFailure', 'executionFailure']) {
  test(`${failure} halts queued retries instead of applying partial effects again`, async () => {
    const fixture = createApplicationHarness({ [failure]: true })
    const results = await Promise.allSettled([
      fixture.instance.add(fixture.block), fixture.instance.add(fixture.block)
    ])
    assert.equal(results[0].status, 'rejected')
    assert.equal(results[1].status, 'rejected')
    assert.match(results[1].reason.message, /halted after a failed mutation/)
    assert.equal(fixture.counts.fees, 1)
    assert.equal(fixture.counts.executions, 1)
    assert.equal(fixture.counts.rewards, failure === 'executionFailure' ? 0 : 1)
    assert.ok(!fixture.events.includes('added block: block'))
    assert.equal(fixture.instance.loaded, false)
  })
}

test('a failed canonical tip read never authorizes a commit from a stale snapshot', async () => {
  const fixture = createApplicationHarness({ tipFailure: true })
  await assert.rejects(fixture.instance.add(fixture.block), /tip read timed out/)
  assert.equal(fixture.counts.fees, 0)
  assert.equal(fixture.counts.rewards, 0)
})

test('sync cannot replace the canonical marker with a conflicting tip at the same height', async () => {
  const fixture = createApplicationHarness()
  await fixture.instance.add(fixture.block)
  const before = { ...fixture.counts }
  assert.equal(await fixture.instance.sync({ ...fixture.loadedBlock(), hash: 'fork' }), 'errored')
  assert.deepEqual(fixture.counts, before)
})

test('sync failures after mutation also halt gossip retries without charging again', async () => {
  const fixture = createApplicationHarness({ rewardFailure: true })
  assert.equal(await fixture.instance.sync(), 'errored')
  await assert.rejects(fixture.instance.add(fixture.block), /halted after a failed mutation/)
  assert.equal(fixture.counts.executions, 1)
  assert.equal(fixture.counts.fees, 1)
  assert.equal(fixture.counts.rewards, 1)
})

for (const failure of ['fork', 'height', 'read']) {
  test(`sync rejects ${failure} before persisting a recovery target or changing canonical state`, async () => {
    const fixture = createApplicationHarness()
    if (failure === 'fork') fixture.options.syncBlocks = [{ ...fixture.loadedBlock(), previousHash: 'other-parent' }]
    if (failure === 'read') fixture.options.syncReadFailure = true
    const target = { ...fixture.loadedBlock(), ...(failure === 'height' ? { index: 572n } : {}) }
    assert.equal(await fixture.instance.sync(target), 'errored')
    assert.equal(fixture.markers.has('recoveryTarget'), false)
    assert.equal(fixture.markers.has('lastBlock'), false)
    assert.equal(fixture.counts.stores, 0)
    assert.equal(fixture.counts.executions, 0)
    assert.equal(fixture.counts.snapshots, 0)
    assert.equal(fixture.instance.loaded, true)
    fixture.options.syncBlocks = undefined
    fixture.options.syncReadFailure = false
    assert.equal(await fixture.instance.sync(), 'synced', 'a rejected fork must not prevent a valid extension')
    assert.equal(fixture.counts.executions, 1)
  })
}

test('restoration applies the verified peer suffix instead of installing an advertised canonical marker', async () => {
  const fixture = createApplicationHarness()
  await fixture.instance.restoreChain()
  assert.equal(fixture.counts.executions, 1)
  assert.equal(fixture.counts.snapshots, 2, 'block commit and final sync checkpoint both complete')
  assert.equal(fixture.markers.has('lastBlock'), false, 'only the checkpoint operation may write lastBlock')
})

test('restoration rejects conflicting ancestry without replacing either durable marker', async () => {
  const fixture = createApplicationHarness()
  fixture.options.syncBlocks = [{ ...fixture.loadedBlock(), previousHash: 'other-parent' }]
  await assert.rejects(fixture.instance.restoreChain(), /unable to restore chain after 3 attempts/)
  assert.equal(fixture.markers.has('lastBlock'), false)
  assert.equal(fixture.markers.has('recoveryTarget'), false)
  assert.equal(fixture.counts.executions, 0)
  assert.equal(fixture.counts.stores, 0)
})

test('the writer remains locked until all asynchronous state work finishes', async () => {
  const queue = new CanonicalStateQueue()
  const gate = deferred()
  const order = []
  const first = queue.run(async () => { order.push('first'); await gate.promise; order.push('done') })
  const second = queue.run(async () => order.push('second'))
  await Promise.resolve()
  assert.deepEqual(order, ['first'])
  gate.resolve()
  await Promise.all([first, second])
  assert.deepEqual(order, ['first', 'done', 'second'])
})

test('epoch scheduling cannot deadlock a validator committing its next block', { timeout: 1000 }, async () => {
  const queue = new CanonicalStateQueue()
  const committed = deferred()
  const epochMethods = methods('../../src/chain.ts', 'Chain', ['#isEpochBoundary', '#handleEpochBoundary'])
  const source = `class Epoch {
    #epochLength = 10
    #currentEpochStartHeight = 0
    #consensusRound = 0
    #participating = true
    #runningEpoch = false
    async #runEpoch() { await queue.run(async () => committed.resolve()) }
    boundary() { return this.#handleEpochBoundary(9) }
    ${epochMethods}
  }`
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText
  const Epoch = new Function('queue', 'committed', 'debug', `${js}; return Epoch`)(queue, committed, () => {})
  const epoch = new Epoch()
  await queue.run(async () => epoch.boundary())
  await committed.promise
})
