import assert from 'node:assert/strict'
import { fork, spawn, execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm, realpath, readdir, mkdir } from 'node:fs/promises'
import { tmpdir, platform, arch, cpus, loadavg } from 'node:os'
import { join, resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { encodeWire, decodeWire } from '@leofcoin/binary'
import { TreeMetrics } from '../test/bench/chain-metrics.js'
import { validateAudit, auditEvidence, summarize } from '../test/bench/chain-audit.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const baseline = option('--baseline', process.env.LEOFCOIN_CHAIN_BASELINE)
const currentOnly = args.includes('--current-only')
const observerFaults = args.includes('--faulty-observers')
const count = Number(option('--transactions', '32'))
const samples = Number(option('--samples', '3'))
const timeout = Number(option('--timeout-ms', '45000'))
if ((!baseline && !currentOnly) || !Number.isInteger(count) || count < 1 || count > 512 || !Number.isInteger(samples) || samples < 1 || samples > 9 ||
  !Number.isInteger(timeout) || timeout < 1000 || timeout > 120000)
  throw new Error('Use --current-only or --baseline <isolated npm directory> [--transactions 1..512] [--samples 1..9] [--timeout-ms 1000..120000]')
const expectedIntegrity = 'sha512-zb3k5uCEZqTr5JgdIBLORcQ0dOwV6I5mdjc0McmNjFlXN/9FvzJ5Xq+r2w6Z12FEeT2DOX15uiaYAXY59RcBMQ=='
let baselineRoot, lockBytes
if (!currentOnly) {
  baselineRoot = await realpath(resolve(baseline))
  lockBytes = await readFile(join(baselineRoot, 'package-lock.json'))
  const lock = JSON.parse(lockBytes)
  const pinnedLock = await readFile(join(root, 'test/bench/baseline/package-lock.json'), 'utf8')
  assert.equal(lockBytes.toString().trim(), pinnedLock.trim(), 'Use the complete reviewed baseline lockfile, not floating transitive dependencies')
  assert.equal(lock.packages['node_modules/@leofcoin/chain']?.version, '1.10.22')
  assert.equal(lock.packages['node_modules/@leofcoin/chain']?.integrity, expectedIntegrity, 'Baseline is not the verified published tarball')
  assert.notEqual(await realpath(join(baselineRoot, 'node_modules/@leofcoin/chain')), await realpath(join(root, 'node_modules/@leofcoin/chain')), 'Baseline must not link current code')
}
const fixture = join(root, 'test/bench/chain-node.js')
async function currentFingerprint() {
  const hash = createHash('sha256')
  let files = 0
  const add = async path => { hash.update(relative(root, path)); hash.update('\0'); hash.update(await readFile(path)); hash.update('\0'); files++ }
  const walk = async path => {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) await walk(join(path, entry.name))
      else if (entry.isFile()) await add(join(path, entry.name))
    }
  }
  for (const name of ['binary', 'chain', 'messages', 'workers', 'lib', 'addresses', 'codecs', 'contracts', 'standards', 'utils']) {
    await add(join(root, 'packages', name, 'package.json'))
    for (const directory of ['src', 'exports']) {
      try { await walk(join(root, 'packages', name, directory)) } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
  }
  await add(join(root, 'package-lock.json'))
  return { sha256: hash.digest('hex'), files }
}
const fingerprint = await currentFingerprint()
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const events = []
const event = value => { events.push(value); console.error(`[chain benchmark] ${value}`) }

class NodeProcess {
  constructor(runtime, data, star) {
    this.events = []; this.pending = new Map(); this.sequence = 0; this.logs = ''
    this.child = fork(fixture, [], { cwd: runtime, serialization: 'advanced', execArgv: [],
      env: { ...process.env, LEOFCOIN_BENCH_RUNTIME: runtime, LEOFCOIN_BENCH_DATA: data, LEOFCOIN_BENCH_STAR: star,
        LEOFCOIN_BENCH_OBSERVER_FAULTS: observerFaults ? '1' : '0' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
    const capture = bytes => {
      this.logTail = (this.logTail || '') + bytes.toString()
      const lines = this.logTail.split('\n'); this.logTail = lines.pop()
      const useful = lines.filter(line => line.trim() && !line.startsWith('[decode] extracted signature'))
      if (useful.length) this.logs = (this.logs + useful.join('\n') + '\n').slice(-20000)
    }
    this.child.stdout.on('data', capture); this.child.stderr.on('data', capture)
    this.child.on('message', bytes => {
      try {
        const message = decodeWire('chain-benchmark', bytes)
        if (message.id) {
          const pending = this.pending.get(message.id)
          if (pending) { clearTimeout(pending.timer); this.pending.delete(message.id); message.error ? pending.reject(new Error(message.error)) : pending.resolve(message.value) }
        } else { this.events.push(message); if (message.type === 'fatal') this.error = new Error(message.error) }
      } catch (error) { this.error = error }
    })
    this.child.on('error', error => { this.error = error })
    this.child.on('exit', (code, signal) => {
      this.exit = { code, signal }
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error(`Benchmark node exited (${code || signal})`)) }
      this.pending.clear()
    })
  }
  async until(check, label) {
    const at = performance.now()
    while (performance.now() - at < timeout) {
      if (this.error) throw this.error
      if (this.exit) throw new Error(`Node exited during ${label}: ${JSON.stringify(this.exit)}\n${this.logs.slice(-3000)}`)
      const value = await check()
      if (value) return value
      await sleep(50)
    }
    throw new Error(`Timed out: ${label}\n${this.logs.slice(-3000)}`)
  }
  ready() { return this.until(() => this.events.find(event => event.type === 'node-ready'), 'node initialization') }
  request(action, input) {
    const id = String(++this.sequence)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timed out: ${action}\n${this.logs.slice(-3000)}`)) }, timeout)
      this.pending.set(id, { resolve, reject, timer })
      this.child.send(encodeWire('chain-benchmark', { id, action, input }))
    })
  }
  async close() {
    if (this.exit) return
    const done = new Promise(resolve => this.child.once('exit', resolve))
    try { await Promise.race([this.request('shutdown'), sleep(1500)]) } catch {}
    if (!this.exit) this.child.kill('SIGTERM')
    const timer = setTimeout(() => this.child.kill('SIGKILL'), 2000)
    await done; clearTimeout(timer)
  }
}
async function startStar() {
  const port = await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(error => error ? reject(error) : resolve(port)) })
  })
  const child = spawn(process.execPath, [join(root, 'test/e2e/star-process.js')], {
    env: { ...process.env, LEOFCOIN_E2E_STAR_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Benchmark star timed out')) }, 10000)
    child.stdout.on('data', bytes => { if (bytes.toString().includes('E2E_STAR_READY')) { clearTimeout(timer); resolve() } })
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Benchmark star exited (${code})`)) })
  })
  child.stderr.resume()
  return { child, url: `ws://127.0.0.1:${port}` }
}
async function run(runtime, label, sample) {
  const temporary = await mkdtemp(join(tmpdir(), 'leofcoin-chain-benchmark-'))
  const nodes = [], result = { label, sample, transactions: count, status: 'failed', phases: {}, audits: {} }
  const check = (name, audit, hashes) => {
    result.audits[name] = auditEvidence(audit)
    validateAudit(audit, hashes, BigInt(count) * 100n)
  }
  let star, metrics, phase = 'startup'
  try {
    event(`${label} sample ${sample}: startup`)
    star = await startStar()
    const source = new NodeProcess(runtime, join(temporary, 'source'), star.url); nodes.push(source)
    await source.ready()
    const seed = await source.request('seed')
    await source.request('start')
    const ingress = new NodeProcess(runtime, join(temporary, 'ingress'), star.url); nodes.push(ingress)
    await ingress.ready(); await ingress.request('seed', seed); await ingress.request('start')
    await source.until(async () => (await source.request('status')).peers >= 1, 'peer connection')
    const signed = await source.request('prepare', count)
    phase = 'confirmation'
    metrics = new TreeMetrics([star.child.pid, source.child.pid, ingress.child.pid])
    await metrics.begin()
    const at = performance.now()
    const hashes = await ingress.request('submit', signed)
    assert.equal(new Set(hashes).size, count)
    await source.until(async () => {
      const status = await source.request('status')
      return hashes.every(hash => status.pending.includes(hash))
    }, 'transaction propagation')
    const vote = source.request('participate')
    await source.until(() => source.events.find(event => event.type === 'block' && event.transactions?.length === count), 'canonical commit')
    await vote
    const durationMs = performance.now() - at
    result.phases.confirmation = { durationMs, transactionsPerSecond: count * 1000 / durationMs, ...await metrics.end() }
    metrics = undefined
    const sourceAudit = await source.request('audit')
    check('source', sourceAudit, hashes)
    await ingress.until(async () => Number((await ingress.request('status')).tip?.index) === 1, 'follower commit')
    const ingressAudit = await ingress.request('audit')
    check('liveFollower', ingressAudit, hashes)
    assert.equal(ingressAudit.tip.hash, sourceAudit.tip.hash)

    phase = 'cold-sync'
    event(`${label} sample ${sample}: cold sync`)
    const observer = new NodeProcess(runtime, join(temporary, 'observer'), star.url); nodes.push(observer)
    await observer.ready(); await observer.request('seed', seed)
    metrics = new TreeMetrics([star.child.pid, ...nodes.map(node => node.child.pid)])
    await metrics.begin()
    const syncAt = performance.now()
    await observer.request('start')
    await observer.until(async () => (await observer.request('status')).tip?.hash === sourceAudit.tip.hash, 'cold sync')
    result.phases.coldSync = { durationMs: performance.now() - syncAt, ...await metrics.end() }
    metrics = undefined
    check('coldObserver', await observer.request('audit'), hashes)
    phase = 'restart'
    await observer.close()
    const restarted = new NodeProcess(runtime, join(temporary, 'observer'), star.url); nodes.push(restarted)
    await restarted.ready(); await restarted.request('seed', seed).then(() => { throw new Error('Restart unexpectedly allowed fixture overwrite') }, error => assert.match(error.message, /fresh private store/))
    // Reloading needs the reference for audit only, not a second state write.
    const restore = await restarted.request('restore', { account: seed.account, recipient: seed.recipient })
    assert.equal(restore, true)
    await restarted.request('start')
    check('restartedObserver', await restarted.request('audit'), hashes)
    result.status = 'passed'
  } catch (error) {
    result.failedPhase = phase; result.error = error.message
    result.nodeDiagnostics = nodes.map(node => ({ pid: node.child.pid, logs: node.logs.slice(-6000) }))
  }
  finally {
    if (metrics) { try { result.failedPhaseResources = await metrics.end() } catch {} }
    await Promise.allSettled(nodes.map(node => node.close()))
    if (star) { const stopped = new Promise(resolve => star.child.once('exit', resolve)); star.child.kill('SIGTERM'); await stopped }
    await rm(temporary, { recursive: true, force: true })
  }
  for (const value of Object.values(result.phases)) value.validForComparison = result.status === 'passed'
  event(`${label} sample ${sample}: ${result.status}${result.error ? ` (${result.failedPhase})` : ''}`)
  return result
}
const results = [], failed = new Set()
for (let sample = 1; sample <= samples; sample++) {
  const variants = currentOnly ? [['current', root]] : sample % 2
    ? [['published-1.10.22', baselineRoot], ['current', root]] : [['current', root], ['published-1.10.22', baselineRoot]]
  for (const [label, runtime] of variants) {
    if (failed.has(label)) continue // Repeating an identical correctness failure cannot produce a valid speedup.
    const result = await run(runtime, label, sample)
    results.push(result)
    if (result.status !== 'passed') failed.add(label)
  }
}
const finalFingerprint = await currentFingerprint()
if (finalFingerprint.sha256 !== fingerprint.sha256) {
  for (const result of results.filter(result => result.label === 'current')) {
    result.status = 'failed'; result.failedPhase = 'artifact-fingerprint'
    result.error = 'Runtime inputs changed during measurement; rebuild and rerun'
    for (const phase of Object.values(result.phases)) phase.validForComparison = false
  }
}
const allPassed = results.every(result => result.status === 'passed') && !failed.size
const report = { schema: 'leofcoin-chain-benchmark-v1', measuredAt: new Date().toISOString(),
  machine: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, loadavg: loadavg() },
  baseline: currentOnly ? null : { version: '1.10.22', gitHead: 'a6c40e5e20678808b65d1df0cac6f2f36dd200b6', integrity: expectedIntegrity,
    lockSha256: createHash('sha256').update(lockBytes).digest('hex') },
  current: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), fingerprint },
  workload: { count, amountPerTransfer: '100', validatorCount: 1, liveNodes: 3, transport: 'loopback WebRTC',
    trustedCommonAnchor: 'height 0, fixture setup excluded', measuredBlocks: 1, blockTimeMs: 6000,
    signingIncluded: false, signatureVerificationIncluded: true, steadyStateCapacityMeasurement: false,
    observerFaultInjection: observerFaults },
  status: allPassed ? 'passed' : 'failed', comparable: !currentOnly && allPassed, summary: summarize(results), results,
  limits: ['One-validator consensus is not a multi-validator mainnet TPS guarantee', 'CPU is sampled over all benchmark descendants; short-lived process tails can be missed',
    'RSS is sampled aggregate resident memory, not unique physical memory', 'Current release also includes safety/recovery changes, not only codec changes'], events }
const output = resolve(option('--output', join(root, 'node_modules/.cache/chain-benchmark-result.json')))
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
console.error(`Report: ${relative(root, output)}`)
if (!allPassed) process.exitCode = 2
