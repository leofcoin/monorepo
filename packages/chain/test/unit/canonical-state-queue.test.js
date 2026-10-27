import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { CanonicalStateQueue } from '../../src/consensus/canonical-state-queue.ts'
import { createApplicationHarness, deferred, methods } from '../helpers/canonical-state-harness.js'

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
