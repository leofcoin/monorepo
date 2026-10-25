import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateGenesisPlan } from '@leofcoin/lib/genesis-plan'
import { createNodeFixture } from './helpers/node-fixture.js'

test('sandboxed Electron loads offline, reviews and downloads a valid public plan', {
  skip: !process.env.CHAIN_MANAGER_DESKTOP_TEST,
  timeout: 30000
}, async t => {
  const { default: electron } = await import('electron')
  const temporary = await mkdtemp(join(tmpdir(), 'leofcoin-chain-manager-'))
  const child = spawn(electron, [
    '.', '--remote-debugging-port=0', `--user-data-dir=${temporary}`
  ], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    stdio: ['ignore', 'ignore', 'pipe']
  })
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit')
      child.kill()
      await exited
    }
    await rm(temporary, { recursive: true, force: true })
  })
  const endpoint = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Electron did not start: ${output}`)), 10000)
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.stderr.on('data', chunk => {
      output += chunk
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
  })
  const base = endpoint.replace('ws:', 'http:').split('/devtools/')[0]
  let target
  for (let i = 0; i < 100 && !target; i++) {
    const targets = await (await fetch(`${base}/json/list`)).json()
    target = targets.find(item => item.type === 'page' && item.url.startsWith('file:'))
    if (!target) await new Promise(resolve => setTimeout(resolve, 30))
  }
  assert.ok(target, 'Electron should load the local app')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await once(socket, 'open')
  t.after(() => socket.close())
  let id = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (!message.id) return
    const request = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id
    pending.set(next, { resolve, reject })
    socket.send(JSON.stringify({ id: next, method, params }))
  })
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  await call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: temporary })
  assert.deepEqual(await evaluate(`({ node: typeof process, require: typeof require, chain: typeof globalThis.chain })`),
    { node: 'undefined', require: 'undefined', chain: 'undefined' })
  const node = await createNodeFixture()
  t.after(() => node.close())
  const operation = await evaluate(`(async () => {
    const { OperatorController } = await import(new URL('./operator.js', document.baseURI))
    const data = new Map()
    const controller = new OperatorController({
      getItem: key => data.get(key) || null,
      setItem: (key, value) => data.set(key, value)
    })
    try {
      await controller.discoverProfile('Isolated smoke-test node', ${JSON.stringify(node.endpoint)}, true)
      await controller.createWallet('desktop-fixture-only-password')
      await controller.prepareFunding(controller.walletAddress, '1')
      const prepared = controller.prepared
      await controller.submitPrepared()
      const admitted = controller.activity[0].status
      await new Promise(resolve => setTimeout(resolve, 100))
      await controller.refreshActivity()
      return { kind: prepared.kind, admitted, canonical: controller.activity[0].status,
        hash: controller.activity[0].hash, error: controller.error }
    } finally { controller.lockWallet() }
  })()`)
  assert.equal(operation.kind, 'fund')
  assert.equal(operation.admitted, 'pending')
  assert.equal(operation.canonical, 'confirmed')
  assert.equal(operation.error, '')
  assert.equal(node.sent.length, 1)
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('chain-manager-app')?.shadowRoot`)); i++) {
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  await evaluate(`Array.from(document.querySelector('chain-manager-app').shadowRoot.querySelectorAll('nav button')).find(button => button.textContent.trim() === 'Genesis').click()`)
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('chain-manager-app')?.shadowRoot?.querySelector('manager-view')?.shadowRoot`)); i++) {
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  const initial = await evaluate(`(async () => {
    const manager = document.querySelector('chain-manager-app').shadowRoot.querySelector('manager-view')
    manager.owner = 'YTqyQkkaMKMTShz7LQh8XdxdZ2GPsXkd1bYHpqQWEF7tQyABZ9DGb'
    manager.initial = '100'
    manager.target = '1000'
    manager.stars = ''
    await manager.updateComplete
    manager.shadowRoot.querySelector('button.primary').click()
    while (manager.busy) await new Promise(resolve => setTimeout(resolve, 10))
    return { step: manager.step, error: manager.error }
  })()`)
  assert.deepEqual(initial, { step: 1, error: '' })
  const review = await evaluate(`(async () => {
    const manager = document.querySelector('chain-manager-app').shadowRoot.querySelector('manager-view')
    await manager.updateComplete
    manager.shadowRoot.querySelector('button.primary').click()
    while (manager.busy) await new Promise(resolve => setTimeout(resolve, 10))
    await manager.updateComplete
    return { step: manager.step, error: manager.error, fingerprint: manager.fingerprint,
      disabled: manager.shadowRoot.querySelector('button.primary').disabled }
  })()`)
  assert.equal(review.step, 2)
  assert.equal(review.error, '')
  assert.match(review.fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(review.disabled, true)
  await evaluate(`(async () => {
    const manager = document.querySelector('chain-manager-app').shadowRoot.querySelector('manager-view')
    manager.acknowledged = true
    await manager.updateComplete
    manager.shadowRoot.querySelector('button.primary').click()
  })()`)
  const path = join(temporary, 'leofcoin-genesis-plan.json')
  let json
  for (let i = 0; i < 100 && !json; i++) {
    try { json = await readFile(path, 'utf8') }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      await new Promise(resolve => setTimeout(resolve, 30))
    }
  }
  assert.ok(json, 'Electron should download the public plan')
  const plan = await validateGenesisPlan(JSON.parse(json))
  assert.equal(plan.initialSupply, '100')
  assert.equal(plan.targetSupply, '1000')
})
