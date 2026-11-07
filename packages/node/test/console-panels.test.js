import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

// Exercise real controllers with an inert renderer and fake clock, not a live node or wallet.
async function loadComponent(relative) {
  const source = (await readFile(new URL(relative, import.meta.url), 'utf8')).replace(/^import .*$/gm, '')
  const prefix = `
    const property = () => () => undefined;
    const state = property;
    const customElement = () => value => value;
    const html = (strings, ...values) => ({ strings: [...strings], values });
    const css = html;
    const repeat = (items, key, render) => items.map(render);
    const consoleDrawerStyles = '';
    const isBackdropClick = () => false;
    const getSelectedNetwork = () => ({ label: 'Fixture' });
    export const timers = new Map();
    let nextTimer = 0;
    const setTimeout = callback => { timers.set(++nextTimer, callback); return nextTimer; };
    const clearTimeout = id => timers.delete(id);
    class LitElement extends EventTarget {
      isConnected = true;
      dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
      shadowRoot = { querySelector: () => this.dialog };
      disconnectedCallback() {}
      connectedCallback() {}
      requestUpdate() {}
    }
  `
  const { code } = await transform(prefix + source, { loader: 'ts', target: 'es2022', format: 'esm' })
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

function renderedText(template) {
  if (Array.isArray(template)) return template.map(renderedText).join('')
  if (template && Array.isArray(template.strings)) return template.strings.map((text, index) => text + renderedText(template.values[index])).join('')
  return template === undefined || template === null || typeof template === 'function' ? '' : String(template)
}

test('notification history is bounded, timestamps are kept and evicted timers are cancelled', async () => {
  const { NotificationController, timers } = await loadComponent('../src/notification/controller.ts')
  const controller = new NotificationController()
  let changed
  controller.addEventListener('notifications-change', event => { changed = event.detail })
  for (let index = 0; index < 105; index++) controller.createNotification({ title: `Notice ${index}`, message: 'Fixture' })
  assert.equal(controller.entries.length, 100)
  assert.equal(timers.size, 100)
  assert.equal(controller.entries.at(-1).title, 'Notice 5')
  assert.ok(controller.entries.every(entry => entry.createdAt > 0))
  assert.equal(changed.unread, 100)
  const template = controller.render()
  const recentEntries = template.values.find(Array.isArray)
  assert.equal(recentEntries.length, 3)
  assert.match(renderedText(template), /97 more notifications/)
  controller.disconnectedCallback()
  assert.equal(timers.size, 0)
  assert.equal(controller.entries.some(entry => entry.recent), false)
})

test('opening history marks entries read and cancels toast expiry without deleting history', async () => {
  const { NotificationController, timers } = await loadComponent('../src/notification/controller.ts')
  const controller = new NotificationController()
  controller.createNotification({ title: 'Info', message: 'Fixture' })
  controller.createNotification({ title: 'Error', message: 'Fixture', type: 'error' })
  assert.equal(timers.size, 2)
  controller.open = true
  controller.updated(new Map([['open', false]]))
  assert.equal(controller.dialog.open, true)
  assert.equal(controller.unread, 0)
  assert.equal(timers.size, 0)
  assert.equal(controller.entries.length, 2)
  controller.filter = 'error'
  assert.match(renderedText(controller.render()), /Errors \(1\)/)
  controller.open = false
  controller.updated(new Map([['open', true]]))
  assert.equal(controller.dialog.open, false)
  controller.disconnectedCallback()
})

test('early dismissal and hover expiry never remove a second notification or throw', async () => {
  const { NotificationController, timers } = await loadComponent('../src/notification/controller.ts')
  const controller = new NotificationController()
  controller.createNotification({ title: 'First', message: 'Fixture' })
  const expired = timers.values().next().value
  const card = controller.render().values.find(Array.isArray)[0]
  card.values[4]() // actual notification-dismiss listener
  assert.equal(controller.entries.length, 0)
  assert.equal(timers.size, 0)
  controller.createNotification({ title: 'Second', message: 'Fixture' })
  assert.doesNotThrow(expired)
  assert.equal(controller.entries[0].title, 'Second')
  const second = controller.render().values.find(Array.isArray)[0]
  second.values[5]() // actual notification-pause listener
  assert.equal(timers.size, 0)
  second.values[6]() // actual notification-resume listener
  assert.equal(timers.size, 1)
  timers.values().next().value()
  assert.equal(controller.entries[0].recent, false)
  assert.equal(controller.unread, 1)
  controller.disconnectedCallback()
})

test('sync drawer has no imaginary height or progress and supports an observed target of zero', async () => {
  const { SyncInfo } = await loadComponent('../src/elements/sync-info.ts')
  const panel = new SyncInfo()
  assert.match(renderedText(panel.render()), /Waiting for node status/)
  assert.doesNotMatch(renderedText(panel.render()), /<progress/)
  panel.nodeStatus = { state: 'syncing', started: true, label: 'Syncing chain', ready: false, local: -1,
    target: 0, progress: 0, compatible: 1, negotiating: 0, peers: ['fixture'], loaded: 0, resolved: 0 }
  const text = renderedText(panel.render())
  assert.match(text, /Observed target<\/dt><dd>0<\/dd>/)
  assert.match(text, /<progress/)
  assert.match(text, /does not confirm transaction finality/)
  panel.nodeStatus = { ...panel.nodeStatus, ready: true, state: 'ready', progress: 100, target: null }
  assert.doesNotMatch(renderedText(panel.render()), /<progress/)
  assert.match(renderedText(panel.render()), /local chain reports synced/)
  panel.open = true
  panel.updated()
  assert.equal(panel.dialog.open, true)
  panel.open = false
  panel.updated()
  assert.equal(panel.dialog.open, false)
})

test('cached sync drawer ignores stale close events and never opens while disconnected', async () => {
  const { SyncInfo } = await loadComponent('../src/elements/sync-info.ts')
  const panel = new SyncInfo()
  panel.isConnected = false
  panel.open = true
  panel.updated()
  assert.equal(panel.dialog.open, false)
  panel.isConnected = true
  panel.connectedCallback(); panel.updated()
  assert.equal(panel.dialog.open, true)
  const [, close] = panel.render().values
  close({ target: panel.dialog })
  assert.equal(panel.open, true, 'queued close from a previous opening must be ignored')
  panel.dialog.open = false
  close({ target: panel.dialog })
  assert.equal(panel.open, false, 'a real native closure still dismisses the panel')
})
