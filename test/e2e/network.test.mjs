import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const nodeScript = join(dirname(fileURLToPath(import.meta.url)), 'node-process.mjs')

class TestNode {
  constructor(home, index) {
    this.home = home
    this.index = index
    this.events = []
    this.stderr = ''
  }

  async start() {
    this.process = spawn(process.execPath, [nodeScript], {
      env: { ...process.env, HOME: this.home, LEOFCOIN_E2E_PASSWORD: `validator-${this.index}` },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.process.stderr.setEncoding('utf8')
    this.process.stderr.on('data', (chunk) => (this.stderr += chunk))
    this.process.stdout.setEncoding('utf8')
    this.process.stdout.on('data', (chunk) => {
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('E2E_EVENT:')) continue
        const event = JSON.parse(line.slice(10))
        this.events.push(event)
        this.onEvent?.(event)
      }
    })
    return this.waitFor('ready')
  }

  waitFor(type) {
    const existing = this.events.find((event) => event.type === type)
    if (existing) return Promise.resolve(existing)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`node ${this.index} timed out waiting for ${type}\n${this.stderr}`)),
        30_000
      )
      this.onEvent = (event) => {
        if (event.type === 'error') {
          clearTimeout(timeout)
          reject(new Error(event.stack || event.message))
        }
        if (event.type === type) {
          clearTimeout(timeout)
          resolve(event)
        }
      }
      this.process.once('exit', (code) => {
        if (code !== 0 && !this.events.some((event) => event.type === type)) {
          clearTimeout(timeout)
          reject(new Error(`node ${this.index} exited with ${code}\n${this.stderr}`))
        }
      })
    })
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
  const nodes = homes.map((home, index) => new TestNode(home, index))
  try {
    const ready = await Promise.all(nodes.map((node) => node.start()))
    assert.equal(new Set(ready.map(({ identity }) => identity)).size, 4)
    assert.equal(new Set(ready.map(({ account }) => account)).size, 4)
    for (const state of ready) {
      assert.deepEqual(state.chain, { sync: 'connectionless', chain: 'loaded' })
      assert.equal(state.peers, 0)
      assert.equal(state.lastBlock.hash, '0x0')
      assert.equal(Number(state.lastBlock.index), -1)
    }

    const before = ready[0]
    await nodes[0].stop()
    nodes[0] = new TestNode(homes[0], 0)
    const after = await nodes[0].start()
    assert.equal(after.identity, before.identity)
    assert.equal(after.account, before.account)
    assert.deepEqual(after.chain, { sync: 'connectionless', chain: 'loaded' })
  } finally {
    await Promise.allSettled(nodes.map((node) => node.stop()))
    await Promise.all(homes.map((home) => rm(home, { recursive: true, force: true })))
  }
})
