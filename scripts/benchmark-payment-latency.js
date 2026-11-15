import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { createRuntimeNetwork } from '../test/helpers/runtime-network.js'

const args = process.argv.slice(2)
const usage = 'Usage: node scripts/benchmark-payment-latency.js [--samples 20..200] [--delivery-delay-ms 0..1000] [--output path]'
let samples = 20
let deliveryDelayMs = 0
let output = fileURLToPath(new URL('../node_modules/.cache/payment-latency.json', import.meta.url))
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index], value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(usage)
  if (flag === '--samples') samples = Number(value)
  else if (flag === '--delivery-delay-ms') deliveryDelayMs = Number(value)
  else if (flag === '--output') output = resolve(value)
  else throw new Error(usage)
}
if (!Number.isInteger(samples) || samples < 20 || samples > 200 ||
  !Number.isInteger(deliveryDelayMs) || deliveryDelayMs < 0 || deliveryDelayMs > 1000) throw new Error(usage)
process.env.LEOFCOIN_BENCH_DELIVERY_DELAY_MS = String(deliveryDelayMs)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const summary = values => {
  assert(values.length > 0 && values.every(value => Number.isFinite(value) && value >= 0))
  const sorted = [...values].sort((a, b) => a - b)
  const percentile = percent => sorted[Math.ceil(sorted.length * percent) - 1]
  return { count: values.length, min: sorted[0], p50: percentile(0.5),
    p95: percentile(0.95), p99: percentile(0.99), max: sorted.at(-1) }
}
const report = {
  schema: 'leofcoin-payment-latency-v1', status: 'failed', validators: 4, quorum: 3, samples,
  environment: { node: process.version, transport: 'loopback WebRTC', network: 'leofcoin:e2e', deliveryDelayMs },
  scope: 'current production cadence; isolated synthetic anchor; not a geographic latency guarantee',
  measurement: 'parent monotonic clock; signing through durable block notifications; all four validators required',
  targetP95Ms: 2000, variants: []
}
let activeNetwork

async function measure(blockTimeMs) {
  const network = activeNetwork = await createRuntimeNetwork()
  const variant = { blockTimeMs, payments: [] }
  report.variants.push(variant)
  try {
    const validators = [0, 1, 2, 3].map(index => network.add(`validator-${index}`))
    const identities = await Promise.all(validators.map(node => node.ready()))
    assert.equal(new Set(identities.map(identity => identity.account)).size, 4)
    const seed = await validators[0].request('seed', { members: identities.map(identity => identity.account) })
    await Promise.all(validators.slice(1).map(node => node.request('seed', seed)))
    await Promise.all(validators.map(node => node.request('start')))
    await Promise.all(validators.map(node =>
      node.until(async () => (await node.request('status')).peers >= 3, 'four validator connections')))
    await Promise.all(validators.map(node => node.request('participate')))
    const hashes = []
    const payment = async measured => {
      const start = performance.now()
      const signed = await validators[0].request('prepare', 1)
      const admitted = await validators[1].request('submit', signed)
      assert.equal(admitted.length, 1)
      const hash = admitted[0]
      hashes.push(hash)
      const admissionMs = performance.now() - start
      const commits = await Promise.all(validators.map(node => node.until(
        () => node.events.find(event => event.type === 'block' && event.transactions.includes(hash)),
        'durable payment confirmation')))
      assert.equal(new Set(commits.map(commit => commit.hash)).size, 1, 'validator tips diverged')
      const validatorMs = commits.map(commit => commit.receivedAt - start)
      if (measured) variant.payments.push({
        hash, blockHash: commits[0].hash, admissionMs, validatorMs,
        allValidatorsMs: Math.max(...validatorMs), ingressMs: validatorMs[1]
      })
    }
    // Exclude the immediately eligible synthetic-anchor block.
    await payment(false)
    for (let index = 0; index < samples; index++) {
      await sleep(blockTimeMs * ((0.15 + index * 0.618033988749895) % 1))
      await payment(true)
      console.log(`[payment latency] ${blockTimeMs} ms profile: ${index + 1}/${samples}`)
    }
    const history = await validators[0].request('history')
    const measured = history.slice(seed.anchorHeight + 1)
    assert.equal(measured.length, samples + 1)
    assert.deepEqual(measured.flatMap(block => block.transactions).sort(), [...hashes].sort())
    const intervals = measured.slice(1).map((block, index) => Number(block.timestamp) - Number(measured[index].timestamp))
    assert(intervals.every(interval => interval >= blockTimeMs), 'proposal cadence was bypassed')
    variant.audits = await Promise.all(validators.map(async node => {
      const audit = await node.request('audit')
      assert.equal(audit.nonce, BigInt(samples + 1))
      assert.equal(audit.recipientBalance, BigInt(samples + 1) * 100n)
      assert.equal(audit.nativeTransfers, BigInt(samples + 1))
      assert.equal(audit.totalTransactions, BigInt((samples + 1) * 2))
      assert.equal(audit.balanceSum, audit.supply)
      assert.deepEqual(await node.request('history'), history)
      return { tip: audit.tip, nonce: String(audit.nonce), balance: String(audit.recipientBalance), supply: String(audit.supply) }
    }))
    variant.summary = {
      admissionMs: summary(variant.payments.map(payment => payment.admissionMs)),
      ingressDurableMs: summary(variant.payments.map(payment => payment.ingressMs)),
      allValidatorsDurableMs: summary(variant.payments.map(payment => payment.allValidatorsMs)),
      validatorDurableMs: validators.map((_, index) => summary(variant.payments.map(payment => payment.validatorMs[index]))),
      interBlockMs: summary(intervals)
    }
    if (deliveryDelayMs) {
      variant.peerDeliveryDelay = await Promise.all(validators.map(async node => (await node.request('timings')).peerDeliveryDelay))
      assert(variant.peerDeliveryDelay.every(entry => entry?.calls > 0 && entry.minMs > 0),
        'Each validator must receive delayed peer messages')
    }
  } catch (error) {
    variant.error = error.stack
    variant.diagnostics = network.nodes.map(node => ({ exit: node.exit, events: node.events, logs: node.logs }))
    throw error
  } finally {
    await network.close()
    activeNetwork = undefined
  }
}

try {
  await measure(1000)
  report.targetMet = report.variants[0].summary.allValidatorsDurableMs.p95 <= report.targetP95Ms
  report.status = report.targetMet ? 'passed' : 'target-missed'
  if (!report.targetMet) process.exitCode = 2
} catch (error) {
  report.error = error.stack
  report.diagnostics = activeNetwork?.nodes.map(node => ({ exit: node.exit, events: node.events, logs: node.logs }))
  process.exitCode = 1
} finally {
  if (activeNetwork) {
    try { await activeNetwork.close() }
    catch (error) { report.cleanupError = error.message; process.exitCode = 1 }
  }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify({ status: report.status, targetMet: report.targetMet,
  variants: report.variants.map(variant => ({ blockTimeMs: variant.blockTimeMs, summary: variant.summary })), error: report.error }, null, 2))
