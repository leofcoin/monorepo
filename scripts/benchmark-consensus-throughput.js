import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { cpus, loadavg } from 'node:os'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { createRuntimeNetwork } from '../test/helpers/runtime-network.js'
import { auditEvidence, validateAudit } from '../test/bench/chain-audit.js'
import { currentFingerprint } from '../test/bench/chain-fingerprint.js'
import { MAX_BLOCK_TRANSACTIONS, MAX_BLOCK_TRANSACTION_BYTES } from '@leofcoin/lib'

const args = process.argv.slice(2)
const root = fileURLToPath(new URL('../', import.meta.url))
const minimum = MAX_BLOCK_TRANSACTIONS * 2
const usage = `Usage: node scripts/benchmark-consensus-throughput.js [--transactions ${minimum}..8192] [--signing-concurrency 1..32] [--batched-ingress true|false] [--output path]`
let count = 8192
let signingConcurrency = 1
let batchedIngress = false
let output = resolve(root, 'node_modules/.cache/consensus-throughput-result.json')
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index], value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(usage)
  if (flag === '--transactions') count = Number(value)
  else if (flag === '--signing-concurrency') signingConcurrency = Number(value)
  else if (flag === '--batched-ingress' && (value === 'true' || value === 'false')) batchedIngress = value === 'true'
  else if (flag === '--output') output = resolve(value)
  else throw new Error(usage)
}
if (!Number.isInteger(count) || count < minimum || count > 8192) throw new Error(usage)
if (!Number.isInteger(signingConcurrency) || signingConcurrency < 1 || signingConcurrency > 32) throw new Error(usage)
const serialize = value => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? String(item) : item, 2)
const report = {
  schema: 'leofcoin-consensus-throughput-v1', status: 'failed', measuredAt: new Date().toISOString(),
  validators: 4, quorum: 3, transfers: count,
  ingress: { signingConcurrency, batchedIngress },
  limits: { transactionsPerBlock: MAX_BLOCK_TRANSACTIONS, transactionBodyBytesPerBlock: MAX_BLOCK_TRANSACTION_BYTES },
  host: { node: process.version, cpu: cpus()[0]?.model, loadavg: loadavg() },
  scope: 'loopback WebRTC; trusted fixture anchor; preloaded signed native transfers; unchanged core cadence and limits',
  runtimeFingerprint: await currentFingerprint(root)
}
let network
try {
  network = await createRuntimeNetwork()
  const validators = [0, 1, 2, 3].map(index => {
    const node = network.add(`throughput-validator-${index}`)
    node.timeout = 120000
    return node
  })
  const identities = await Promise.all(validators.map(node => node.ready()))
  assert.equal(new Set(identities.map(node => node.account)).size, 4)
  const seed = await validators[0].request('seed', { members: identities.map(node => node.account) })
  await Promise.all(validators.slice(1).map(node => node.request('seed', seed)))
  await Promise.all(validators.map(node => node.request('start')))
  await Promise.all(validators.map(node =>
    node.until(async () => (await node.request('status')).peers >= 3, 'four validator connections')))
  report.protocol = (await validators[0].request('status')).protocol
  const hashes = []
  const preloadAt = performance.now()
  let signingMs = 0, admissionMs = 0, propagationWaitMs = 0
  for (let offset = 0; offset < count; offset += 512) {
    let phaseAt = performance.now()
    const size = Math.min(512, count - offset)
    const signed = signingConcurrency === 1
      ? await validators[0].request('prepare', size)
      : await validators[0].request('prepare-parallel', { count: size, concurrency: signingConcurrency })
    signingMs += performance.now() - phaseAt
    phaseAt = performance.now()
    hashes.push(...await validators[1].request(batchedIngress ? 'submit-batch' : 'submit', signed))
    admissionMs += performance.now() - phaseAt
    phaseAt = performance.now()
    await validators[0].until(async () =>
      (await validators[0].request('status')).pending.length === hashes.length, 'preload propagation')
    propagationWaitMs += performance.now() - phaseAt
    console.log(`[consensus throughput] preloaded ${hashes.length}/${count}`)
  }
  assert.equal(new Set(hashes).size, count)
  await Promise.all(validators.map(node =>
    node.until(async () => (await node.request('status')).pending.length === count, 'fully replicated backlog')))
  report.signingAdmissionAndReplicationMs = performance.now() - preloadAt
  report.preloadPhases = { signingMs, admissionMs, propagationWaitMs }
  await Promise.all(validators.map(node => node.request('timings', { reset: true })))
  const startedAt = performance.now()
  await Promise.all(validators.map(node => node.request('participate')))
  const finalEvents = await Promise.all(validators.map(node => node.until(() =>
    node.events.find(event => event.type === 'block' && event.transactions.includes(hashes.at(-1))),
  'durable backlog drain')))
  assert.equal(new Set(finalEvents.map(event => event.index)).size, 1)
  const commits = validators[0].events.filter(event => event.type === 'block' && event.index > seed.anchorHeight)
  assert(commits.length > 1, 'Multiple blocks are required to measure inter-commit throughput')
  const intervalMs = commits.at(-1).receivedAt - commits[0].receivedAt
  const steadyTransfers = commits.slice(1).reduce((sum, block) => sum + block.transactions.length, 0)
  report.backlogDrain = {
    durationMs: Math.max(...finalEvents.map(event => event.receivedAt)) - startedAt,
    blocks: commits.length, blockTransactionCounts: commits.map(block => block.transactions.length)
  }
  report.backlogDrain.transactionsPerSecond = count * 1000 / report.backlogDrain.durationMs
  report.steadyState = { durationMs: intervalMs, transfers: steadyTransfers,
    transactionsPerSecond: steadyTransfers * 1000 / intervalMs, excludesImmediatelyEligibleFirstBlock: true }
  report.operationTimings = await Promise.all(validators.map(node => node.request('timings')))
  const history = await validators[0].request('history')
  const measured = history.filter(block => block.index > seed.anchorHeight)
  const intervals = measured.slice(1).map((block, index) => Number(block.timestamp) - Number(measured[index].timestamp))
  assert(intervals.every(interval => interval >= 1000), 'real one-second cadence was bypassed')
  assert.equal(commits.length, measured.length)
  const orderedIntervals = intervals.toSorted((a, b) => a - b)
  report.interBlockMs = { min: orderedIntervals[0],
    median: orderedIntervals[Math.floor(orderedIntervals.length / 2)],
    p95: orderedIntervals[Math.ceil(orderedIntervals.length * 0.95) - 1], max: orderedIntervals.at(-1) }
  const auditNode = async node => {
    const audit = await node.request('audit')
    validateAudit(audit, hashes, BigInt(count) * 100n)
    assert.deepEqual(await node.request('history'), history)
    return auditEvidence(audit)
  }
  report.audits = await Promise.all(validators.map(auditNode))
  console.log('[consensus throughput] four validator audits passed; starting cold sync')
  const cold = network.add('throughput-cold-observer')
  cold.timeout = 120000
  await cold.ready()
  await cold.request('seed', seed)
  const syncAt = performance.now()
  await cold.request('start')
  await cold.until(async () => (await cold.request('status')).tip?.hash === history.at(-1).hash, 'large-block cold sync')
  report.coldSync = { durationMs: performance.now() - syncAt, audit: await auditNode(cold) }
  console.log('[consensus throughput] cold-sync audit passed; restarting observer')
  await cold.close()
  const restarted = network.add('throughput-cold-observer')
  restarted.timeout = 120000
  await restarted.ready()
  await restarted.request('restore', { account: seed.account, recipient: seed.recipient, anchorHeight: seed.anchorHeight })
  await restarted.request('start')
  report.restart = await auditNode(restarted)
  assert.deepEqual(await currentFingerprint(root), report.runtimeFingerprint, 'Runtime changed during measurement')
  report.status = 'passed'
} catch (error) {
  report.error = error.stack
  report.diagnostics = network?.nodes.map(node => ({ exit: node.exit, events: node.events, logs: node.logs }))
  process.exitCode = 1
} finally {
  try { await network?.close() }
  catch (error) { report.status = 'failed'; report.cleanupError = error.message; process.exitCode = 1 }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, serialize(report) + '\n')
}
const summary = ({ transactions, ...audit }) => audit
console.log(serialize({ ...report, audits: report.audits?.map(summary),
  coldSync: report.coldSync && { ...report.coldSync, audit: summary(report.coldSync.audit) },
  restart: report.restart && summary(report.restart), diagnostics: undefined }))
console.log(`Report: ${output}`)
