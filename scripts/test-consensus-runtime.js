import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRuntimeNetwork } from '../test/helpers/runtime-network.js'

const args = process.argv.slice(2)
const count = args.length ? Number(args[1]) : 12
if ((args.length && (args.length !== 2 || args[0] !== '--blocks')) || !Number.isInteger(count) || count < 4 || count > 64)
  throw new Error('Usage: node scripts/test-consensus-runtime.js [--blocks 4..64]')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const events = []
const event = message => { events.push(message); console.log(`[consensus runtime] ${message}`) }
const report = { schema: 'leofcoin-consensus-runtime-v1', status: 'failed', validators: 4, blocks: count,
  transport: 'loopback WebRTC', setup: 'trusted common pre-activation anchor; not public genesis generation',
  faults: ['two validators cannot finalize', 'healing and round change', 'validator crash at precommit'], events }
let network
try {
  network = await createRuntimeNetwork()
  let validators = [0, 1, 2, 3].map(index => network.add(`validator-${index}`))
  const identities = await Promise.all(validators.map(node => node.ready()))
  const seed = await validators[0].request('seed', { members: identities.map(node => node.account) })
  const anchorHeight = seed.anchorHeight ?? 0
  await Promise.all(validators.slice(1).map(node => node.request('seed', seed)))
  await Promise.all(validators.map(node => node.request('start')))
  for (const node of validators) await node.until(async () => (await node.request('status')).peers >= 3, 'four validator connections')
  await Promise.all(validators.map(node => node.request('participate')))
  event('Four independently signed validators online; quorum is three')
  const hashes = []
  const commit = async (height, nodes = validators) => {
    for (const node of nodes) await node.until(async () => (await node.request('status')).tip?.index === anchorHeight + height, `commit height ${height}`)
    const tips = await Promise.all(nodes.map(node => node.request('status')))
    assert.equal(new Set(tips.map(node => node.tip.hash)).size, 1, 'validators diverged')
  }
  const submit = async () => {
    const signed = await validators[0].request('prepare', 1)
    const submitted = await validators[1].request('submit', signed)
    hashes.push(...submitted)
  }
  await submit(); await commit(1)
  event('Initial four-validator commit verified')
  // Keep the round-zero proposer in the two-validator minority, ensuring a real
  // proposal is attempted but cannot collect three authenticated votes.
  const sorted = [...identities].sort((a, b) => a.account < b.account ? -1 : a.account > b.account ? 1 : 0)
  const proposer = sorted[(anchorHeight + 2) % sorted.length].account
  const minority = [identities.findIndex(node => node.account === proposer)]
  minority.push([0, 1, 2, 3].find(index => !minority.includes(index)))
  const isolated = [0, 1, 2, 3].filter(index => !minority.includes(index))
  await Promise.all(isolated.map(index => validators[index].request('partition', true)))
  await submit()
  await validators[minority[0]].until(() => validators[minority[0]].events.some(event => event.type === 'proposal' && Number(event.index) === anchorHeight + 2), 'minority proposal')
  await sleep(1500)
  for (const node of validators) assert.equal((await node.request('status')).tip.index, anchorHeight + 1, 'minority finalized without quorum')
  event('Two-validator minority cannot finalize a proposed block')
  await Promise.all(isolated.map(index => validators[index].request('partition', false)))
  await commit(2)
  event('Partition healed; all four converge after round retry')

  const crashIndex = identities.findIndex(node => node.account === sorted[(anchorHeight + 3) % sorted.length].account)
  const crashed = validators[crashIndex]
  // Hold other precommits until the designated proposer reaches that boundary,
  // avoiding a race where it simply learns a commit before emitting its own vote.
  await Promise.all(validators.filter(node => node !== crashed).map(node => node.request('partition', 'precommit-only')))
  await crashed.request('crash-on-precommit')
  await submit()
  const until = Date.now() + 45000
  while (!crashed.exit && Date.now() < until) await sleep(50)
  assert.equal(crashed.exit?.code, 86, 'validator did not crash at the armed boundary')
  assert(crashed.events.some(event => event.type === 'injected-crash'))
  await Promise.all(validators.filter(node => node !== crashed).map(node => node.request('partition', false)))
  await commit(3, validators.filter(node => node !== crashed))
  const replacement = network.add(`validator-${crashIndex}`)
  await replacement.ready()
  await replacement.request('restore', { account: seed.account, recipient: seed.recipient, anchorHeight })
  await replacement.request('start')
  validators[crashIndex] = replacement
  await commit(3)
  await replacement.request('participate')
  event('Validator killed during precommit restarted and recovered without duplicate execution')

  for (let height = 4; height <= count; height++) { await submit(); await commit(height); event(`Canonical history verified through height ${height}`) }
  const canonical = await validators[0].request('history')
  assert.equal(canonical.length, count + anchorHeight + 1)
  assert.deepEqual(canonical.slice(anchorHeight + 1).flatMap(block => block.transactions).sort(), [...hashes].sort())
  const verify = async node => {
    const audit = await node.request('audit')
    assert.equal(audit.nonce, BigInt(count))
    assert.equal(audit.recipientBalance, BigInt(count) * 100n)
    assert.equal(audit.nativeTransfers, BigInt(count))
    assert.equal(audit.totalTransactions, BigInt(count * 2), 'each transfer plus one membership snapshot per block')
    assert.equal(audit.balanceSum, audit.supply)
    assert.deepEqual(await node.request('history'), canonical)
    return { hash: audit.tip.hash, nonce: String(audit.nonce), recipientBalance: String(audit.recipientBalance) }
  }
  report.audits = await Promise.all(validators.map(verify))
  const cold = network.add('cold-observer')
  await cold.ready(); await cold.request('seed', seed); await cold.request('start')
  await cold.until(async () => (await cold.request('status')).tip.index === anchorHeight + count, 'longer-history cold sync')
  report.coldSync = await verify(cold)
  await cold.close()
  const restarted = network.add('cold-observer')
  await restarted.ready(); await restarted.request('restore', { account: seed.account, recipient: seed.recipient, anchorHeight }); await restarted.request('start')
  report.restart = await verify(restarted)
  report.status = 'passed'
  event('Cold sync and durable restart preserve exact ancestry, membership, balances and nonces')
} catch (error) {
  report.error = error.stack
  report.diagnostics = network?.nodes.map(node => ({ pid: node.child.pid, exit: node.exit, events: node.events, logs: node.logs.slice(-8000) }))
  process.exitCode = 1
} finally {
  try { await network?.close() }
  catch (error) { report.status = 'failed'; report.cleanupError = error.message; process.exitCode = 1 }
}
await mkdir(new URL('../node_modules/.cache/', import.meta.url), { recursive: true })
await writeFile(new URL('../node_modules/.cache/consensus-runtime-result.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
if (report.status !== 'passed') console.error(report.error, report.diagnostics)
