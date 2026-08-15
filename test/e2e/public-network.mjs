import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const nodeScript = join(dirname(fileURLToPath(import.meta.url)), 'node-process.js')
const remoteUrl = process.env.LEOFCOIN_REMOTE_URL || 'https://remote.leofcoin.org'
const star = process.env.LEOFCOIN_PUBLIC_STAR || 'wss://star.leofcoin.org'
const requestedMinutes = Number(process.env.LEOFCOIN_SOAK_MINUTES || 30)
if (!Number.isFinite(requestedMinutes) || requestedMinutes <= 0 || requestedMinutes > 60) {
  throw new Error('LEOFCOIN_SOAK_MINUTES must be between 0 and 60')
}
const durationMs = requestedMinutes * 60_000
const pollMs = 15_000
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const remoteTip = async () => {
  const response = await fetch(`${remoteUrl}/lastBlock`, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`remote lastBlock returned HTTP ${response.status}`)
  const value = await response.json()
  const tip = { hash: value.hash, index: Number(value.index) }
  if (typeof tip.hash !== 'string' || !Number.isSafeInteger(tip.index)) throw new Error('remote returned invalid tip')
  return tip
}

class ObserverNode {
  constructor(home, index) {
    this.home = home
    this.index = index
    this.events = []
    this.output = ''
  }

  async start() {
    this.child = spawn(process.execPath, [nodeScript], {
      env: {
        ...process.env,
        HOME: this.home,
        LEOFCOIN_E2E_PASSWORD: `github-observer-${this.index}`,
        LEOFCOIN_E2E_NETWORK: 'leofcoin:peach',
        LEOFCOIN_E2E_NETWORK_VERSION: 'peach',
        LEOFCOIN_E2E_ROOT: '.leofcoin/peach',
        LEOFCOIN_E2E_STAR: star
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child.stdout.setEncoding('utf8')
    this.child.stderr.setEncoding('utf8')
    this.child.stdout.on('data', (chunk) => this.#consume(chunk))
    this.child.stderr.on('data', (chunk) => (this.output += chunk))
    return this.waitFor('ready', 60_000)
  }

  #consume(chunk) {
    this.output += chunk
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('E2E_EVENT:')) continue
      const event = JSON.parse(line.slice(10))
      this.events.push(event)
      this.listener?.(event)
    }
  }

  waitFor(type, timeoutMs = 30_000, after = 0) {
    const existing = this.events.slice(after).find((event) => event.type === type)
    if (existing) return Promise.resolve(existing)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`observer ${this.index} timed out waiting for ${type}\n${this.output.slice(-8_000)}`)), timeoutMs)
      this.listener = (event) => {
        if (event.type === 'error') {
          clearTimeout(timeout)
          reject(new Error(event.stack || event.message))
        } else if (event.type === type) {
          clearTimeout(timeout)
          resolve(event)
        }
      }
    })
  }

  status() {
    const after = this.events.length
    this.child.stdin.write('status\n')
    return this.waitFor('status', 30_000, after)
  }

  async stop() {
    if (!this.child || this.child.exitCode !== null) return
    const exited = new Promise((resolve) => this.child.once('exit', resolve))
    this.child.stdin.write('shutdown\n')
    const timeout = setTimeout(() => this.child.kill('SIGKILL'), 5_000)
    await exited
    clearTimeout(timeout)
  }
}

const homes = await Promise.all([0, 1].map((index) => mkdtemp(join(tmpdir(), `leofcoin-public-${index}-`))))
const nodes = homes.map((home, index) => new ObserverNode(home, index))

const verify = async () => {
  const [canonical, ...statuses] = await Promise.all([remoteTip(), ...nodes.map((node) => node.status())])
  for (const status of statuses) {
    if (status.connectedPeers < 1) throw new Error(`observer has no connected peers: ${JSON.stringify(status)}`)
    if (status.lastBlock?.hash !== canonical.hash || Number(status.lastBlock?.index) !== canonical.index) {
      throw new Error(`observer tip differs from remote: remote=${JSON.stringify(canonical)} observer=${JSON.stringify(status.lastBlock)}`)
    }
  }
  process.stdout.write(`public network converged at ${canonical.index}:${canonical.hash}\n`)
}

const verifyEventually = async (timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs
  let failure
  while (Date.now() < deadline) {
    try {
      return await verify()
    } catch (error) {
      failure = error
      await delay(2_000)
    }
  }
  throw failure
}

try {
  await Promise.all(nodes.map((node) => node.start()))
  await verifyEventually()
  const deadline = Date.now() + durationMs
  const restartAt = Date.now() + Math.floor(durationMs / 2)
  let restarted = false
  while (Date.now() < deadline) {
    await verify()
    if (!restarted && Date.now() >= restartAt) {
      await nodes[1].stop()
      nodes[1] = new ObserverNode(homes[1], 1)
      await nodes[1].start()
      restarted = true
      await verifyEventually()
    }
    await delay(Math.min(pollMs, Math.max(0, deadline - Date.now())))
  }
  await verify()
} finally {
  await Promise.allSettled(nodes.map((node) => node.stop()))
  await Promise.all(homes.map((home) => rm(home, { recursive: true, force: true })))
}
