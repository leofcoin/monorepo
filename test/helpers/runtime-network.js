import { fork, spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { performance } from 'node:perf_hooks'
import { encodeWire, decodeWire } from '@leofcoin/binary'

const runtime = fileURLToPath(new URL('../../', import.meta.url))
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
export class RuntimeNode {
  constructor(data, star, timeout = 45000, blockTimeMs) {
    this.data = data; this.timeout = timeout; this.events = []; this.pending = new Map(); this.sequence = 0; this.logs = ''
    this.child = fork(join(runtime, 'test/bench/chain-node.js'), [], { cwd: runtime, execArgv: [], serialization: 'advanced',
      env: { ...process.env, LEOFCOIN_BENCH_RUNTIME: runtime, LEOFCOIN_BENCH_DATA: data, LEOFCOIN_BENCH_STAR: star,
        LEOFCOIN_BENCH_BLOCK_TIME_MS: blockTimeMs === undefined ? '' : String(blockTimeMs),
        LEOFCOIN_BENCH_OBSERVER_FAULTS: '0' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
    const capture = bytes => { this.logs = (this.logs + bytes.toString()).slice(-12000) }
    this.child.stdout.on('data', capture); this.child.stderr.on('data', capture)
    this.child.on('message', bytes => {
      try {
        const event = decodeWire('chain-benchmark', bytes)
        if (event.id) {
          const request = this.pending.get(event.id)
          if (request) { clearTimeout(request.timer); this.pending.delete(event.id); event.error ? request.reject(new Error(event.error)) : request.resolve(event.value) }
        } else {
          this.events.push({ ...event, receivedAt: performance.now() })
          if (event.type === 'fatal') this.error = new Error(event.error)
        }
      } catch (error) { this.error = error }
    })
    this.child.on('error', error => { this.error = error })
    this.child.on('exit', (code, signal) => {
      this.exit = { code, signal }
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error(`Node exited: ${code ?? signal}`)) }
      this.pending.clear()
    })
  }
  async until(check, label) {
    const until = Date.now() + this.timeout
    while (Date.now() < until) {
      if (this.error) throw this.error
      if (this.exit) throw new Error(`Node exited during ${label}: ${JSON.stringify(this.exit)}\n${this.logs}`)
      const result = await check()
      if (result) return result
      await sleep(50)
    }
    throw new Error(`Timed out: ${label}\n${this.logs}`)
  }
  ready() { return this.until(() => this.events.find(event => event.type === 'node-ready'), 'node ready') }
  request(action, input) {
    if (this.exit || !this.child.connected) return Promise.reject(new Error('Node is not running'))
    const id = String(++this.sequence)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`RPC timed out: ${action}\n${this.logs}`)) }, this.timeout)
      this.pending.set(id, { resolve, reject, timer })
      this.child.send(encodeWire('chain-benchmark', { id, action, input }), error => {
        if (error && this.pending.delete(id)) { clearTimeout(timer); reject(error) }
      })
    })
  }
  async close() {
    if (this.exit || !this.child.pid) return
    const done = once(this.child, 'exit')
    let timer
    try {
      await Promise.race([this.request('shutdown').catch(() => {}), sleep(1500)])
      if (!this.exit) this.child.kill('SIGTERM')
      timer = setTimeout(() => this.child.kill('SIGKILL'), 2000)
      await done
    } finally { clearTimeout(timer) }
  }
}

export async function createRuntimeNetwork({ blockTimeMs } = {}) {
  if (blockTimeMs !== undefined && blockTimeMs !== 1000 && blockTimeMs !== 6000)
    throw new Error('Isolated benchmark block time must be 1000 or 6000 ms')
  const directory = await mkdtemp(join(tmpdir(), 'leofcoin-consensus-runtime-'))
  const nodes = []
  let star
  try {
    const port = await new Promise((resolve, reject) => {
      const server = createServer().once('error', reject)
      server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(error => error ? reject(error) : resolve(port)) })
    })
    star = spawn(process.execPath, [join(runtime, 'test/e2e/star-process.js')], {
      env: { ...process.env, LEOFCOIN_E2E_STAR_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] })
    star.stderr.resume()
    await new Promise((resolve, reject) => {
      let output = ''
      const timer = setTimeout(() => reject(new Error('Discovery star timeout')), 10000)
      star.once('error', error => { clearTimeout(timer); reject(error) })
      star.once('exit', code => { clearTimeout(timer); reject(new Error(`Discovery star exited: ${code}`)) })
      star.stdout.on('data', bytes => { output += bytes.toString(); if (output.includes('E2E_STAR_READY')) { clearTimeout(timer); resolve() } })
    })
    return {
      nodes,
      add(name) {
        if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid isolated node name')
        const node = new RuntimeNode(join(directory, name), `ws://127.0.0.1:${port}`, 45000, blockTimeMs)
        nodes.push(node); return node
      },
      async close() {
        await Promise.allSettled(nodes.map(node => node.close()))
        if (nodes.some(node => node.child.pid && node.child.exitCode === null && node.child.signalCode === null))
          throw new Error(`A test process did not stop; temporary stores retained at ${directory}`)
        if (star.exitCode === null && star.signalCode === null) { const done = once(star, 'exit'); star.kill('SIGTERM'); await done }
        await rm(directory, { recursive: true, force: true })
      }
    }
  } catch (error) {
    if (star && star.exitCode === null && star.signalCode === null) { const done = once(star, 'exit'); star.kill(); await done }
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
