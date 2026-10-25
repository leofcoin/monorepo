import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join, extname, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

// Opt in after `npm run build`; uses only a local fixture and native CDP.
// CHROME_BIN="/path/to/chrome" node --test test/shell-ui.test.js
test('responsive shell, wallet navigation and notification lifecycle', {
  skip: !process.env.CHROME_BIN, timeout: 45000
}, async t => {
  const root = resolve('www')
  const fixture = new URL('./shell-ui-fixture.html', import.meta.url)
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname
      const path = resolve(root, pathname.slice(1))
      if (pathname !== '/' && !path.startsWith(root + sep)) {
        response.writeHead(403).end()
        return
      }
      const content = await readFile(pathname === '/' ? fixture : path)
      response.setHeader('Content-Type', pathname === '/' ? 'text/html' : {
        '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json'
      }[extname(path)] || 'application/octet-stream')
      response.end(content)
    } catch { response.writeHead(404).end() }
  }).listen(0, '127.0.0.1')
  t.after(() => { server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const profile = await mkdtemp(join(tmpdir(), 'leofcoin-shell-ui-'))
  const chrome = spawn(process.env.CHROME_BIN, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  t.after(async () => {
    if (chrome.exitCode === null) {
      chrome.kill()
      await once(chrome, 'exit')
    }
    await rm(profile, { recursive: true, force: true })
  })
  const endpoint = await new Promise((accept, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error('Chrome did not start')), 10000)
    chrome.on('error', error => { clearTimeout(timeout); reject(error) })
    chrome.stderr.on('data', chunk => {
      output += chunk
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) { clearTimeout(timeout); accept(match[1]) }
    })
  })
  const targets = await (await fetch(`${endpoint.replace('ws:', 'http:').split('/devtools/')[0]}/json/list`)).json()
  const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await once(socket, 'open')
  t.after(() => socket.close())
  let nextId = 0
  const pending = new Map()
  const errors = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) request.reject(new Error(message.error.message))
      else request.accept(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  })
  const call = (method, params = {}) => new Promise((accept, reject) => {
    const id = ++nextId
    pending.set(id, { accept, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`Boolean(${expression})`)) return
      await new Promise(accept => setTimeout(accept, 30))
    }
    throw new Error(`Timed out: ${expression}`)
  }
  const resize = async width => {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
  }
  const click = async expression => {
    const { x, y } = await evaluate(`(() => {
      const rect = (${expression}).getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    })()`)
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  }
  await call('Runtime.enable')
  await resize(1280)
  await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
  await waitFor(`globalThis.fixtureReady && shell.shadowRoot.querySelector('wallet-view')?.shadowRoot?.querySelector('wallet-send')?.shadowRoot`)
  assert.equal(await evaluate(`shell.isDesktop`), true)
  assert.equal(await evaluate(`shell.shadowRoot.querySelectorAll('.primary-nav a').length`), 8)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('a[aria-current="page"]').dataset.route`), 'wallet')
  assert.equal(await evaluate(`!shell.shadowRoot.querySelector('login-screen')`), true)
  assert.equal(await evaluate(`!shell.shadowRoot.querySelector('export-screen')`), true)
  assert.equal(await evaluate(`!shell.shadowRoot.querySelector('sync-info')`), true)
  assert.equal(await evaluate(`getComputedStyle(shell.shadowRoot.querySelector('.menu-toggle')).display`), 'none')
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('#main-content').children.length`), 1)
  await evaluate(`shell.shadowRoot.querySelector('.sync-status-pill').click()`)
  await waitFor(`shell.shadowRoot.querySelector('sync-info')?.open`)
  await evaluate(`globalThis.cachedSyncInfo = shell.shadowRoot.querySelector('sync-info');
    cachedSyncInfo.shadowRoot.querySelector('custom-pane').dispatchEvent(new CustomEvent(
      'custom-pane-close', { detail: cachedSyncInfo.id, bubbles: true, composed: true }
    ))`)
  await waitFor(`!shell.shadowRoot.querySelector('sync-info')`)
  await evaluate(`shell.shadowRoot.querySelector('.sync-status-pill').click()`)
  await waitFor(`shell.shadowRoot.querySelector('sync-info') === cachedSyncInfo && cachedSyncInfo.open`)
  await evaluate(`cachedSyncInfo.shadowRoot.querySelector('custom-pane').dispatchEvent(new CustomEvent(
    'custom-pane-close', { detail: cachedSyncInfo.id, bubbles: true, composed: true }
  ))`)
  await waitFor(`!shell.shadowRoot.querySelector('sync-info')`)
  await evaluate(`globalThis.fixtureWallet = shell.wallet;
    shell.wallet = undefined;
    shell.currentRoute = 'identity'`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`globalThis.cachedLoginScreen = shell.shadowRoot.querySelector('login-screen');
    shell.currentRoute = 'stats'`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`shell.currentRoute = 'identity'`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen') === cachedLoginScreen`)
  await evaluate(`shell.wallet = fixtureWallet;
    shell.currentRoute = 'wallet'`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`shell.passwordPromptOpen = true`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`shell.passwordPromptOpen = false`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`shell.passwordPromptOpen = true`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen') === cachedLoginScreen`)
  await evaluate(`shell.passwordPromptOpen = false`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`globalThis.walletView = shell.shadowRoot.querySelector('wallet-view');
    globalThis.cachedSendView = walletView.shadowRoot.querySelector('wallet-send');
    await walletView.select('receive')`)
  await waitFor(`walletView.selectedRoute === 'receive' && walletView.pages.children.length === 1`)
  await evaluate(`await walletView.select('send')`)
  await waitFor(`walletView.selectedRoute === 'send' && walletView.pages.children.length === 1`)
  assert.equal(await evaluate(`walletView.shadowRoot.querySelector('wallet-send') === cachedSendView`), true)
  await evaluate(`await shell.select('identity')`)
  await waitFor(`shell.currentRoute === 'identity' && shell.shadowRoot.querySelector('#main-content').querySelector('.custom-selected')?.dataset.route === 'identity'`)
  await evaluate(`globalThis.identityView = shell.shadowRoot.querySelector('identity-view');
    await identityView.select('accounts')`)
  await waitFor(`identityView.selectedRoute === 'accounts' && identityView.pages.children.length === 1`)
  await evaluate(`globalThis.cachedAccountsView = identityView.shadowRoot.querySelector('identity-accounts');
    await identityView.select('dashboard');
    await identityView.select('accounts')`)
  await waitFor(`identityView.selectedRoute === 'accounts' && identityView.shadowRoot.querySelector('identity-accounts') === cachedAccountsView`)
  await evaluate(`await shell.select('wallet')`)
  await waitFor(`shell.currentRoute === 'wallet'`)
  await evaluate(`shell.showExport('data:image/png;base64,', 'fixture backup')`)
  await waitFor(`shell.shadowRoot.querySelector('export-screen')`)
  await evaluate(`globalThis.cachedExportScreen = shell.shadowRoot.querySelector('export-screen');
    cachedExportScreen.click()`)
  await waitFor(`!shell.shadowRoot.querySelector('export-screen')`)
  await evaluate(`shell.showExport('data:image/png;base64,', 'fixture backup')`)
  await waitFor(`shell.shadowRoot.querySelector('export-screen') === cachedExportScreen`)
  await evaluate(`cachedExportScreen.click()`)
  await waitFor(`!shell.shadowRoot.querySelector('export-screen')`)
  await evaluate(`globalThis.initialWalletView = walletView;
    await shell.select('stats')`)
  await waitFor(`shell.currentRoute === 'stats' && shell.shadowRoot.querySelector('#main-content').querySelector('.custom-selected')?.dataset.route === 'stats'`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('#main-content').children.length`), 1)
  await evaluate(`await shell.select('wallet')`)
  await waitFor(`shell.currentRoute === 'wallet' && shell.shadowRoot.querySelector('#main-content').querySelector('.custom-selected')?.dataset.route === 'wallet'`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('wallet-view') === initialWalletView`), true)

  await resize(390)
  await waitFor(`!shell.isDesktop`)
  await click(`shell.shadowRoot.querySelector('.menu-toggle')`)
  await waitFor(`shell.drawerOpen && shell.shadowRoot.querySelector('.main').inert`)
  assert.equal(await evaluate(`shell.shadowRoot.activeElement.dataset.route`), 'wallet')
  await evaluate(`shell.shadowRoot.querySelector('.drawer-close').focus()`)
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8 })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', modifiers: 8 })
  assert.equal(await evaluate(`shell.shadowRoot.activeElement.dataset.route`), 'stats')
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor(`!shell.drawerOpen`)
  assert.equal(await evaluate(`shell.shadowRoot.activeElement.classList.contains('menu-toggle')`), true)
  await evaluate(`shell.shadowRoot.querySelector('.menu-toggle').click()`)
  await waitFor(`shell.drawerOpen`)
  await resize(1100)
  await waitFor(`shell.isDesktop && !shell.drawerOpen`)
  await resize(390)
  await waitFor(`!shell.isDesktop`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('#app-navigation').inert`), true)
  await click(`shell.shadowRoot.querySelector('.menu-toggle')`)
  await waitFor(`shell.drawerOpen`)
  await evaluate(`shell.shadowRoot.querySelector('.drawer-backdrop').click()`)
  await waitFor(`!shell.drawerOpen`)

  await evaluate(`globalThis.account = shell.shadowRoot.querySelector('account-select');
    account.shadowRoot.querySelector('.account-trigger').click()`)
  await waitFor(`account.selecting`)
  assert.equal(await evaluate(`account.shadowRoot.querySelector('.accounts-container').getBoundingClientRect().right <= innerWidth`), true)
  await evaluate(`account.shadowRoot.querySelector('.account-trigger').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await waitFor(`!account.selecting`)

  await evaluate(`globalThis.notices = shell.notificationController;
    notices.createNotification({ title: 'Dismiss early', message: 'No timer exception' }, 250);
    notices.createNotification({ title: 'Persistent', message: 'Saved in session', type: 'warning' }, 0);`)
  await waitFor(`notices.shadowRoot.querySelectorAll('.recents notification-child').length === 2`)
  await evaluate(`notices.shadowRoot.querySelectorAll('.recents notification-child')[1].shadowRoot.querySelector('button').click()`)
  await new Promise(accept => setTimeout(accept, 300))
  assert.equal(await evaluate(`notices.entries.length`), 1)
  await evaluate(`notices.createNotification({ title: 'Pause', message: 'Readable long message' }, 100)`)
  await waitFor(`notices.entries.length === 2`)
  await evaluate(`notices.shadowRoot.querySelector('.recents notification-child').shadowRoot.querySelector('article').dispatchEvent(new Event('pointerenter'))`)
  await new Promise(accept => setTimeout(accept, 150))
  assert.equal(await evaluate(`notices.entries[0].recent`), true)
  await evaluate(`notices.shadowRoot.querySelector('.recents notification-child').shadowRoot.querySelector('article').dispatchEvent(new Event('pointerleave'))`)
  await waitFor(`!notices.entries[0].recent`)
  assert.equal(await evaluate(`notices.unread`), 2)
  await evaluate(`shell.shadowRoot.querySelector('.notification-toggle').focus(); shell.shadowRoot.querySelector('.notification-toggle').click()`)
  await waitFor(`notices.shadowRoot.querySelector('dialog').open`)
  assert.equal(await evaluate(`notices.unread`), 0)
  assert.equal(await evaluate(`notices.shadowRoot.querySelectorAll('.list notification-child').length`), 2)
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor(`!notices.open && !shell.notificationsOpen`)
  assert.equal(await evaluate(`shell.shadowRoot.activeElement.classList.contains('notification-toggle')`), true)
  await evaluate(`shell.shadowRoot.querySelector('.notification-toggle').click()`)
  await waitFor(`notices.open`)
  await evaluate(`notices.shadowRoot.querySelector('footer button').click()`)
  await waitFor(`notices.entries.length === 0`)
  assert.equal(await evaluate(`notices.shadowRoot.querySelector('.empty strong').textContent`), "You're all caught up")
  await evaluate(`notices.shadowRoot.querySelector('.close').click()`)
  await waitFor(`!notices.open`)

  await evaluate(`globalThis.walletView = shell.shadowRoot.querySelector('wallet-view'); undefined`)
  await click(`walletView.shadowRoot.querySelector('a[href="#!/wallet/receive"]')`)
  await waitFor(`walletView.selectedRoute === 'receive' && walletView.shadowRoot.querySelector('wallet-receive')?.shadowRoot?.querySelector('input')`)
  assert.equal(await evaluate(`walletView.shadowRoot.querySelector('a[aria-current="page"]').textContent.trim()`), 'Receive')
  assert.equal(await evaluate(`walletView.shadowRoot.querySelector('wallet-receive').shadowRoot.querySelectorAll('label input').length`), 2)
  await evaluate(`location.hash = '#!/wallet/pay'`)
  await waitFor(`walletView.selectedRoute === 'pay' && walletView.shadowRoot.querySelector('wallet-pay')?.shadowRoot?.querySelector('textarea')`)
  assert.equal(await evaluate(`shell.pages.style.position`), '')
  await click(`walletView.shadowRoot.querySelector('a[href="#!/wallet/transactions"]')`)
  await waitFor(`walletView.selectedRoute === 'transactions'`)
  assert.equal(await evaluate(`shell.pages.style.position`), '')
  await click(`walletView.shadowRoot.querySelector('a[href="#!/wallet/send"]')`)
  await waitFor(`walletView.selectedRoute === 'send'`)
  for (const width of [320, 390, 768, 1280]) {
    await resize(width)
    await waitFor(`innerWidth === ${width}`)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `document overflow at ${width}px`)
    assert.equal(await evaluate(`shell.shadowRoot.querySelector('header').scrollWidth <= shell.shadowRoot.querySelector('header').clientWidth`), true, `header overflow at ${width}px`)
    assert.equal(await evaluate(`walletView.shadowRoot.querySelector('nav').getBoundingClientRect().right <= innerWidth`), true, `wallet navigation overflow at ${width}px`)
  }
  await click(`shell.shadowRoot.querySelector('.notification-toggle')`)
  await waitFor(`notices.open`)
  assert.equal(await evaluate(`notices.shadowRoot.querySelector('dialog').getBoundingClientRect().right <= innerWidth`), true)
  await click(`notices.shadowRoot.querySelector('.close')`)
  await waitFor(`!notices.open`)
  assert.deepEqual(errors, [])
})
