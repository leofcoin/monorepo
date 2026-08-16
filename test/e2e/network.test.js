import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createServer } from 'node:net'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const nodeScript = join(dirname(fileURLToPath(import.meta.url)), 'node-process.js')
const starScript = join(dirname(fileURLToPath(import.meta.url)), 'star-process.js')

const availablePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close((error) => (error ? reject(error) : resolve(port)))
    })
  })

const startStar = async (port) => {
  const child = spawn(process.execPath, [starScript], {
    env: { ...process.env, LEOFCOIN_E2E_STAR_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => (stderr += chunk))
  child.stdout.setEncoding('utf8')
  child.starPeers = 0
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`star startup timed out\n${stderr}`)), 10_000)
    child.stdout.on('data', (chunk) => {
      const peerCount = chunk.match(/E2E_STAR_PEERS:(\d+)/g)?.at(-1)?.split(':').at(-1)
      if (peerCount) child.starPeers = Number(peerCount)
      if (!chunk.includes('E2E_STAR_READY')) return
      clearTimeout(timeout)
      resolve()
    })
    child.once('exit', (code) => reject(new Error(`star exited with ${code}\n${stderr}`)))
  })
  return child
}

const waitForStarPeers = async (star, minimum, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (star.starPeers >= minimum) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`discovery star saw ${star.starPeers}/${minimum} nodes`)
}

class TestNode {
  constructor(home, index, star) {
    this.home = home
    this.index = index
    this.star = star
    this.events = []
    this.stderr = ''
    this.stdout = ''
  }

  async start() {
    this.process = spawn(process.execPath, [nodeScript], {
      env: {
        ...process.env,
        HOME: this.home,
        LEOFCOIN_E2E_PASSWORD: `validator-${this.index}`,
        LEOFCOIN_E2E_STAR: this.star
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.process.stderr.setEncoding('utf8')
    this.process.stderr.on('data', (chunk) => (this.stderr += chunk))
    this.process.stdout.setEncoding('utf8')
    this.process.stdout.on('data', (chunk) => {
      this.stdout += chunk
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('E2E_EVENT:')) continue
        const event = JSON.parse(line.slice(10))
        this.events.push(event)
        this.onEvent?.(event)
      }
    })
    return this.waitFor('ready')
  }

  waitFor(type, afterIndex = 0) {
    const existing = this.events.slice(afterIndex).find((event) => event.type === type)
    if (existing) return Promise.resolve(existing)
    return new Promise((resolve, reject) => {
      const cleanup = () => this.process.removeListener('exit', onExit)
      const timeout = setTimeout(
        () => {
          cleanup()
          reject(
            new Error(
              `node ${this.index} timed out waiting for ${type}`
                + `\nstdout=${this.stdout.slice(-8_000)}\nstderr=${this.stderr.slice(-8_000)}`
            )
          )
        },
        30_000
      )
      const onExit = (code) => {
        if (code !== 0 && !this.events.slice(afterIndex).some((event) => event.type === type)) {
          clearTimeout(timeout)
          reject(new Error(`node ${this.index} exited with ${code}\n${this.stderr}`))
        }
      }
      this.onEvent = (event) => {
        if (event.type === 'error') {
          clearTimeout(timeout)
          cleanup()
          reject(new Error(event.stack || event.message))
        }
        if (event.type === type) {
          clearTimeout(timeout)
          cleanup()
          resolve(event)
        }
      }
      this.process.once('exit', onExit)
    })
  }

  async status() {
    return this.command('status', 'status')
  }

  async command(command, eventType) {
    const afterIndex = this.events.length
    this.process.stdin.write(`${command}\n`)
    return this.waitFor(eventType, afterIndex)
  }

  appendBlock() {
    return this.command('append-block', 'block:produced')
  }

  async waitForPeers(minimum, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs
    let current
    while (Date.now() < deadline) {
      current = await this.status()
      if (current.connectedPeers >= minimum) return current
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(
      `node ${this.index} did not reach ${minimum} connected peers; last status=${JSON.stringify(current)}`
        + `\nstdout=${this.stdout.slice(-4_000)}\nstderr=${this.stderr.slice(-4_000)}`
    )
  }

  async waitForTip({ hash, index }, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs
    let current
    while (Date.now() < deadline) {
      current = await this.status()
      if (
        current.lastBlock?.hash === hash &&
        Number(current.lastBlock?.index) === Number(index) &&
        current.chain?.sync === 'synced'
      ) {
        return current
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(
      `node ${this.index} did not sync tip ${hash}@${index}; last status=${JSON.stringify(current)}`
        + `\nstdout=${this.stdout.slice(-4_000)}\nstderr=${this.stderr.slice(-4_000)}`
    )
  }

  async stop() {
    if (!this.process || this.process.exitCode !== null) return
    const exited = new Promise((resolve) => this.process.once('exit', resolve))
    this.process.stdin.write('shutdown\n')
    const timer = setTimeout(() => this.process.kill('SIGKILL'), 5_000)
    await exited
    clearTimeout(timer)
  }
}

test('four isolated nodes converge on bootstrap state and survive restart', { timeout: 60_000 }, async () => {
  const homes = await Promise.all(
    Array.from({ length: 4 }, (_, index) => mkdtemp(join(tmpdir(), `leofcoin-e2e-${index}-`)))
  )
  const port = await availablePort()
  const star = await startStar(port)
  const starUrl = `ws://127.0.0.1:${port}`
  const nodes = homes.map((home, index) => new TestNode(home, index, starUrl))
  try {
    const ready = await Promise.all(nodes.map((node) => node.start()))
    await waitForStarPeers(star, 4)
    assert.equal(new Set(ready.map(({ identity }) => identity)).size, 4)
    assert.equal(new Set(ready.map(({ account }) => account)).size, 4)
    for (const state of ready) {
      assert.deepEqual(state.chain, { sync: 'connectionless', chain: 'loaded' })
      assert.equal(state.lastBlock.hash, '0x0')
      assert.equal(Number(state.lastBlock.index), -1)
    }

    const connected = await Promise.all(nodes.map((node) => node.waitForPeers(3)))
    assert.ok(connected.every(({ connectedPeers }) => connectedPeers >= 3))

    const before = ready[0]
    await nodes[0].stop()
    nodes[0] = new TestNode(homes[0], 0, starUrl)
    const after = await nodes[0].start()
    assert.equal(after.identity, before.identity)
    assert.equal(after.account, before.account)
    assert.deepEqual(after.chain, { sync: 'connectionless', chain: 'loaded' })
    await nodes[0].waitForPeers(3)
  } finally {
    await Promise.allSettled(nodes.map((node) => node.stop()))
    star.kill('SIGKILL')
    await Promise.all(homes.map((home) => rm(home, { recursive: true, force: true })))
  }
})

test('a late node cold-syncs canonical blocks and keeps them across restart', { timeout: 90_000 }, async () => {
  const homes = await Promise.all(
    Array.from({ length: 2 }, (_, index) => mkdtemp(join(tmpdir(), `leofcoin-sync-e2e-${index}-`)))
  )
  const port = await availablePort()
  const star = await startStar(port)
  const starUrl = `ws://127.0.0.1:${port}`
  const nodes = homes.map((home, index) => new TestNode(home, index, starUrl))

  try {
    await nodes[0].start()
    const first = await nodes[0].appendBlock()
    const tip = await nodes[0].appendBlock()
    assert.equal(first.index, 0)
    assert.equal(tip.index, 1)

    const source = await nodes[0].status()
    assert.equal(source.lastBlock.hash, tip.hash)
    assert.equal(Number(source.lastBlock.index), tip.index)
    assert.deepEqual(source.blockHashes.sort(), [first.hash, tip.hash].sort())

    await nodes[1].start()
    await waitForStarPeers(star, 2)
    await Promise.all(nodes.map((node) => node.waitForPeers(1)))
    const synced = await nodes[1].waitForTip(tip)
    assert.deepEqual(synced.blockHashes, source.blockHashes)
    assert.equal(synced.stateSnapshot, source.stateSnapshot)

    await nodes[1].stop()
    nodes[1] = new TestNode(homes[1], 1, starUrl)
    const restarted = await nodes[1].start()
    assert.equal(restarted.lastBlock.hash, tip.hash)
    assert.equal(Number(restarted.lastBlock.index), tip.index)
    assert.deepEqual(restarted.blockHashes, source.blockHashes)
    assert.equal(restarted.stateSnapshot, source.stateSnapshot)
    await nodes[1].waitForPeers(1)
  } finally {
    await Promise.allSettled(nodes.map((node) => node.stop()))
    star.kill('SIGKILL')
    await Promise.all(homes.map((home) => rm(home, { recursive: true, force: true })))
  }
})

test('deploys and trades an LFC test-token pool in the contract VM', { timeout: 60_000 }, async () => {
  const home = await mkdtemp(join(tmpdir(), 'leofcoin-dex-e2e-'))
  const port = await availablePort()
  const star = await startStar(port)
  const node = new TestNode(home, 0, `ws://127.0.0.1:${port}`)

  try {
    await node.start()
    const deployed = await node.command('dex-fixture', 'dex:deployed')
    assert.equal(deployed.poolFor, deployed.pool)
    assert.equal(deployed.quoted, deployed.received)
    assert.ok(BigInt(deployed.received) > 0n)
    assert.equal(deployed.reserves.length, 2)
    assert.ok(deployed.factory)
    assert.ok(deployed.testToken)
  } finally {
    await node.stop()
    star.kill('SIGKILL')
    await rm(home, { recursive: true, force: true })
  }
})
