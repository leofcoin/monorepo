import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join, extname, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

// Opt in after `npm run build`; uses only a local fixture and native CDP.
// RUN_SHELL_UI_TESTS=1 CHROME_BIN="/path/to/chrome" node --test test/shell-ui.test.js
const runShellUiTests = process.env.RUN_SHELL_UI_TESTS === '1' && Boolean(process.env.CHROME_BIN)

async function createShellFixture(t) {
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
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, replMode: true, userGesture: true })
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
  const resize = async (width, height = 900) => {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
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
  return { evaluate, waitFor, resize, click, call, errors }
}

test('removed manager route returns to wallet without loading a manager view', {
  skip: !runShellUiTests, timeout: 15000
}, async t => {
  const { evaluate, waitFor, errors } = await createShellFixture(t)
  await evaluate(`location.hash = '#!/manager'`)
  await waitFor(`location.hash === '#!/wallet' && shell.currentRoute === 'wallet'`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('manager-view') === null`), true)
  assert.equal(await evaluate(`shell.notificationController.entries.some(entry =>
    entry.message === 'Chain manager is now a separate app.')`), true)
  assert.deepEqual(errors, [])
})

test('responsive shell, wallet navigation and notification lifecycle', {
  skip: !runShellUiTests, timeout: 45000
}, async t => {
  const { evaluate, waitFor, resize, click, call, errors } = await createShellFixture(t)
  assert.equal(await evaluate(`shell.isDesktop`), true)
  assert.equal(await evaluate(`shell.shadowRoot.querySelectorAll('.primary-nav a').length`), 9)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.network-switcher select').value`), 'peach')
  assert.deepEqual(await evaluate(`Array.from(shell.shadowRoot.querySelectorAll('.network-switcher option')).map(option => option.value)`), ['mainnet', 'peach'])
  await evaluate(`globalThis.originalConfirm = window.confirm;
    window.confirm = message => { window.networkSwitchPrompt = message; return false };
    const networkSelect = shell.shadowRoot.querySelector('.network-switcher select');
    networkSelect.value = 'mainnet';
    networkSelect.dispatchEvent(new Event('change', { bubbles: true }));
    window.confirm = originalConfirm`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.network-switcher select').value`), 'peach')
  assert.equal(await evaluate(`window.networkSwitchPrompt.includes('pending transactions')`), true)
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
    shell.currentRoute = 'identity';
    shell.loginOpen = true`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`globalThis.cachedLoginScreen = shell.shadowRoot.querySelector('login-screen');
    shell.currentRoute = 'stats'; shell.loginOpen = false`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`shell.currentRoute = 'identity'; shell.loginOpen = true`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen') === cachedLoginScreen`)
  await evaluate(`cachedLoginScreen.setAttribute('shown', '');
    shell.wallet = fixtureWallet;
    await shell.select('identity')`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen') === cachedLoginScreen`)
  await evaluate(`cachedLoginScreen.shadowRoot.querySelector('input').focus()`)
  assert.equal(
    await evaluate(`cachedLoginScreen.shadowRoot.activeElement === cachedLoginScreen.shadowRoot.querySelector('input')`),
    true
  )
  await evaluate(`cachedLoginScreen.dispatchEvent(new CustomEvent('login-dismiss', { bubbles: true, composed: true }))`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  assert.equal(
    await evaluate(`cachedLoginScreen.shadowRoot.activeElement !== cachedLoginScreen.shadowRoot.querySelector('input')`),
    true
  )
  await evaluate(`shell.wallet = fixtureWallet;
    shell.currentRoute = 'wallet'`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`shell.passwordPromptOpen = true`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen') === cachedLoginScreen`)
  await evaluate(`globalThis.backupPasswordRequest = cachedLoginScreen.requestPassword()`)
  await waitFor(`cachedLoginScreen.shadowRoot.activeElement === cachedLoginScreen.shadowRoot.querySelector('[data-route="backup"] input')`)
  await evaluate(`const backupInput = cachedLoginScreen.shadowRoot.querySelector('[data-route="backup"] input');
    backupInput.value = 'test-backup-password';
    cachedLoginScreen.shadowRoot.querySelector('[data-route="backup"] button').click()`)
  assert.equal(await evaluate(`await globalThis.backupPasswordRequest`), 'test-backup-password')
  assert.equal(
    await evaluate(`cachedLoginScreen.shadowRoot.activeElement !== cachedLoginScreen.shadowRoot.querySelector('[data-route="backup"] input')`),
    true
  )
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

test('wallet-required views automatically open the unlock dialog and preserve deep links', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, errors } = await createShellFixture(t)
  await evaluate(`globalThis.lockedFixtureWallet = shell.wallet; shell.wallet = undefined;
    globalThis.walletStore = { has: async () => true }; location.hash = '#!/stats'`)
  await waitFor(`shell.currentRoute === 'stats'`)
  for (const route of ['wallet/send', 'identity/accounts', 'chat', 'validator', 'faucet', 'explorer/dashboard', 'explorer/blocks']) {
    await evaluate(`location.hash = '#!/${route}'`)
    await waitFor(`shell.currentRoute === '${route.split('/')[0]}' && shell.shadowRoot.querySelector('login-screen')?.shown`)
    assert.equal(await evaluate(`shell.shadowRoot.querySelector('wallet-required') === null`), true)
    assert.equal(await evaluate(`shell.shadowRoot.querySelector('#main-content').querySelector('${route.split('/')[0]}-view') === null`), true)
  }
  await evaluate(`location.hash = '#!/identity/accounts'`)
  await waitFor(`shell.currentRoute === 'identity'`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen')?.shown`)
  await evaluate(`globalThis.unlockScreen = shell.shadowRoot.querySelector('login-screen');
    unlockScreen.dispatchEvent(new CustomEvent('login-dismiss', { bubbles: true, composed: true }))`)
  await waitFor(`!shell.loginOpen`)
  await evaluate(`location.hash = '#!/stats'`)
  await waitFor(`shell.currentRoute === 'stats'`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('login-screen') === null`), true)
  await evaluate(`location.hash = '#!/identity/accounts'`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen')?.shown`)
  await evaluate(`shell.wallet = lockedFixtureWallet;
    unlockScreen.shown = false;
    unlockScreen.dispatchEvent(new CustomEvent('login-dismiss', { bubbles: true, composed: true }))`)
  await waitFor(`shell.shadowRoot.querySelector('identity-view')?.selectedRoute === 'accounts'`)
  assert.equal(await evaluate(`location.hash`), '#!/identity/accounts')
  await evaluate(`shell.wallet = undefined; location.hash = '#!/stats'`)
  await waitFor(`shell.currentRoute === 'stats' && shell.shadowRoot.querySelector('stats-view')`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('wallet-required') === null`), true)
  assert.deepEqual(errors, [])
})

test('wallet backup steps remain reachable in a short viewport', {
  skip: !runShellUiTests, timeout: 15000
}, async t => {
  const { evaluate, waitFor, resize, click, errors } = await createShellFixture(t)
  await resize(390, 420)
  await evaluate(`shell.loginOpen = true`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`globalThis.backupScreen = shell.shadowRoot.querySelector('login-screen');
    backupScreen.shown = true;
    backupScreen.headline = 'Wallet created';
    backupScreen.decodedMnemonic = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';
    await backupScreen.requestRender();
    backupScreen.shadowRoot.querySelector('custom-pages').select('create')`)
  await waitFor(`backupScreen.shadowRoot.querySelector('[data-route="create"] button.backup-action')`)

  const layout = await evaluate(`(() => {
    const create = backupScreen.shadowRoot.querySelector('[data-route="create"]');
    const passwordStep = create.querySelectorAll('button.backup-action')[1];
    const confirm = create.querySelector('button.backup-confirm');
    create.scrollTop = create.scrollHeight;
    return {
      overflowY: getComputedStyle(create).overflowY,
      passwordStepPresent: Boolean(passwordStep),
      confirmPresent: Boolean(confirm),
      confirmVisible: confirm.getBoundingClientRect().bottom <= create.getBoundingClientRect().bottom
    };
  })()`)
  assert.equal(layout.overflowY, 'auto')
  assert.equal(layout.passwordStepPresent, true)
  assert.equal(layout.confirmPresent, true)
  assert.equal(layout.confirmVisible, true)
  await click(`backupScreen.shadowRoot.querySelector('[data-route="create"] button.backup-action')`)
  await waitFor(`document.querySelector('dialog[data-wallet-backup="recovery-phrase"]')?.open`)
  await evaluate(`const phraseDialog = document.querySelector('dialog[data-wallet-backup="recovery-phrase"]');
    const phrase = phraseDialog.querySelector('flex-wrap-between');
    phrase.scrollTop = phrase.scrollHeight;
    phraseDialog.querySelector('button').click()`)
  await waitFor(`!document.querySelector('dialog[data-wallet-backup="recovery-phrase"]')`)
  assert.equal(await evaluate(`backupScreen.shadowRoot.querySelector('[data-route="create"] .step-marker').hasAttribute('data-complete')`), true)
  assert.deepEqual(errors, [])
})

test('faucet has its own testnet-only route and never mounts on mainnet', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, errors } = await createShellFixture(t)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('aside testnet-faucet') === null`), true)
  await evaluate(`globalThis.faucetReads = 0; globalThis.originalFaucetFetch = fetch;
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith('/status')) {
        faucetReads++;
        return new Response(JSON.stringify({ network: 'leofcoin:peach', testnet: true, ready: true, amount: '10' }));
      }
      return originalFaucetFetch(url, options);
    };
    shell.shadowRoot.querySelector('a[data-route="faucet"]').click()`)
  await waitFor(`shell.currentRoute === 'faucet' && shell.shadowRoot.querySelector('faucet-view')?.shadowRoot?.querySelector('testnet-faucet')?.info?.ready`)
  assert.equal(await evaluate(`location.hash`), '#!/faucet')
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('faucet-view').shadowRoot.querySelector('testnet-faucet').address === shell.wallet.selectedAccount`), true)
  await evaluate(`shell.wallet = { ...shell.wallet, selectedAccount: 'updated-testnet-address' }`)
  await waitFor(`shell.shadowRoot.querySelector('faucet-view').shadowRoot.querySelector('testnet-faucet').address === 'updated-testnet-address'`)
  for (const width of [1280, 320]) {
    await resize(width)
    assert.equal(await evaluate(`(() => { const view = shell.shadowRoot.querySelector('faucet-view'); return view.scrollWidth <= view.clientWidth })()`), true)
  }
  await evaluate(`const view = shell.shadowRoot.querySelector('faucet-view'); view.wallet = undefined; await view.updateComplete`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('faucet-view').shadowRoot.querySelector('testnet-faucet') === null`), true)
  await evaluate(`await shell.select('wallet');
    localStorage.setItem('leofcoin:selected-network:v1', 'mainnet');
    shell.selectedNetworkKey = 'mainnet'; await shell.rendered;
    globalThis.readsBeforeMainnet = faucetReads;
    location.hash = '#!/faucet'`)
  await waitFor(`location.hash === '#!/wallet' && shell.currentRoute === 'wallet'`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('a[data-route="faucet"]') === null`), true)
  await evaluate(`globalThis.mainnetFaucet = document.createElement('faucet-view');
    mainnetFaucet.wallet = shell.wallet; document.body.append(mainnetFaucet); await mainnetFaucet.updateComplete`)
  assert.equal(await evaluate(`mainnetFaucet.shadowRoot.querySelector('testnet-faucet') === null`), true)
  assert.equal(await evaluate(`faucetReads === readsBeforeMainnet`), true)
  assert.deepEqual(errors, [])
})

test('identity refresh covers every subview, account copying, export and reduced motion', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, call, errors } = await createShellFixture(t)
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await evaluate(`location.hash = '#!/identity/dashboard'`)
  await waitFor(`shell.shadowRoot.querySelector('identity-view')?.shadowRoot?.querySelector('identity-dashboard')?.shadowRoot?.querySelector('.hero')`)
  await evaluate(`globalThis.identityView = shell.shadowRoot.querySelector('identity-view');
    globalThis.identityPage = identityView.shadowRoot.querySelector('identity-dashboard'); undefined`)
  assert.equal(await evaluate(`identityPage.shadowRoot.querySelector('.metric strong').textContent`), '1')
  assert.equal(await evaluate(`identityPage.shadowRoot.querySelectorAll('.metric strong')[1].textContent`), '1')
  assert.equal(await evaluate(`getComputedStyle(identityPage.shadowRoot.querySelector('.spark')).animationName !== 'none'`), true)
  await evaluate(`identityPage.shadowRoot.querySelector('a[href="#!/identity/accounts"]').click()`)
  await waitFor(`identityView.selectedRoute === 'accounts' && identityView.shadowRoot.querySelector('identity-accounts')?.shadowRoot?.querySelector('details')`)
  await evaluate(`globalThis.accountPage = identityView.shadowRoot.querySelector('identity-accounts');
    accountPage.shadowRoot.querySelector('summary').click();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async address => { globalThis.copiedIdentityAddress = address }
    } }); undefined`)
  assert.equal(await evaluate(`accountPage.shadowRoot.querySelector('details').open`), true)
  await evaluate(`accountPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`accountPage.message === 'Address copied.'`)
  assert.equal(await evaluate(`copiedIdentityAddress === shell.wallet.accounts[0][1]`), true)
  await evaluate(`navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied') };
    accountPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`accountPage.shadowRoot.querySelector('[role="alert"]')`)
  assert.match(await evaluate(`accountPage.error`), /Clipboard denied/)
  await evaluate(`globalThis.exportReads = 0; globalThis.exportShows = 0;
    shell.requestWalletPassword = async () => 'backup-password';
    globalThis.identityController = { export: () => { exportReads++; return new Promise(resolve => { globalThis.resolveBackup = resolve }) } };
    shell.showExport = (qr, exported) => { exportShows++; globalThis.exportedBackup = exported; globalThis.backupQR = qr };
    location.hash = '#!/identity/actions'`)
  await waitFor(`identityView.shadowRoot.querySelector('identity-actions')?.shadowRoot?.querySelector('button')`)
  await evaluate(`globalThis.backupPage = identityView.shadowRoot.querySelector('identity-actions');
    backupPage.shadowRoot.querySelector('button').click(); backupPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`backupPage.exporting && globalThis.resolveBackup`)
  assert.equal(await evaluate(`exportReads`), 1)
  assert.equal(await evaluate(`backupPage.shadowRoot.querySelector('button').disabled`), true)
  await evaluate(`resolveBackup('encrypted-backup-fixture')`)
  await waitFor(`!backupPage.exporting && exportShows === 1`)
  assert.equal(await evaluate(`exportedBackup`), 'encrypted-backup-fixture')
  assert.match(await evaluate(`backupQR`), /^data:image\/png;base64,/)
  await evaluate(`identityController.export = async () => { throw new Error('Export failed') };
    backupPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`backupPage.shadowRoot.querySelector('[role="alert"]')`)
  assert.match(await evaluate(`backupPage.error`), /Export failed/)
  assert.equal(await evaluate(`backupPage.shadowRoot.querySelector('button').disabled`), false)
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  for (const route of ['dashboard', 'accounts', 'account', 'actions']) {
    await evaluate(`location.hash = '#!/identity/${route}'`)
    await waitFor(`identityView.selectedRoute === '${route}' && identityView.shadowRoot.querySelector('identity-${route}')?.shadowRoot?.querySelector('.hero')`)
    await evaluate(`globalThis.activeIdentityPage = identityView.shadowRoot.querySelector('identity-${route}'); undefined`)
    assert.equal(await evaluate(`activeIdentityPage.shadowRoot.querySelector('.hero-art rect').namespaceURI`), 'http://www.w3.org/2000/svg')
    assert.equal(await evaluate(`getComputedStyle(activeIdentityPage.shadowRoot.querySelector('.spark')).animationName`), 'none')
    assert.equal(await evaluate(`getComputedStyle(activeIdentityPage.shadowRoot.querySelector('.card')).animationName`), 'none')
    if (route === 'account')
      assert.equal(await evaluate(`activeIdentityPage.shadowRoot.querySelector('details').open`), true)
    for (const width of [1280, 390, 320]) {
      await resize(width)
      assert.equal(await evaluate(`activeIdentityPage.scrollWidth <= activeIdentityPage.clientWidth`), true, `${route} overflow at ${width}`)
      assert.equal(await evaluate(`identityView.shadowRoot.querySelector('nav').getBoundingClientRect().right <= innerWidth`), true)
    }
  }
  await evaluate(`identityView.accounts = []; await identityView.select('accounts')`)
  await waitFor(`identityView.shadowRoot.querySelector('identity-accounts')?.shadowRoot?.querySelector('.empty')`)
  assert.equal(await evaluate(`identityView.shadowRoot.querySelector('identity-accounts') === accountPage`), true)
  await evaluate(`await identityView.select('dashboard')`)
  await waitFor(`identityView.shadowRoot.querySelector('identity-dashboard')?.shadowRoot?.querySelector('.empty')`)
  assert.deepEqual(errors, [])
})

test('validator refresh shows registry, explicit participation, failures and responsive motion', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, call, errors } = await createShellFixture(t)
  await evaluate(`globalThis.participationCalls = 0; globalThis.lookupReads = 0;
    globalThis.validatorAddresses = [shell.wallet.selectedAccount, 'another-validator-address'];
    client.lookup = async () => { lookupReads++; return { address: 'validator-contract' } };
    client.staticCall = async () => validatorAddresses;
    client.selectedAccount = async () => shell.wallet.selectedAccount;
    client.participate = async () => { participationCalls++; return false };
    location.hash = '#!/validator'`)
  await waitFor(`shell.shadowRoot.querySelector('validator-view')?.loaded`)
  await evaluate(`globalThis.validatorPage = shell.shadowRoot.querySelector('validator-view'); undefined`)
  assert.equal(await evaluate(`participationCalls`), 0)
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelector('.hero-art path').namespaceURI`), 'http://www.w3.org/2000/svg')
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelector('.metric strong').textContent.trim()`), '2')
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelectorAll('.metric strong')[1].textContent.trim()`), 'Registered')
  await evaluate(`validatorPage.shadowRoot.querySelector('input').value = 'another';
    validatorPage.shadowRoot.querySelector('input').dispatchEvent(new Event('input'))`)
  await waitFor(`validatorPage.query === 'another'`)
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelectorAll('details').length`), 2)
  await evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async address => { globalThis.copiedValidatorAddress = address }
  } });
    validatorPage.shadowRoot.querySelector('details summary').click();
    validatorPage.shadowRoot.querySelector('details button').click()`)
  await waitFor(`validatorPage.message === 'Validator address copied.'`)
  assert.equal(await evaluate(`copiedValidatorAddress`), 'another-validator-address')
  await evaluate(`validatorPage.shadowRoot.querySelector('input').value = 'nothing';
    validatorPage.shadowRoot.querySelector('input').dispatchEvent(new Event('input'))`)
  await waitFor(`validatorPage.shadowRoot.textContent.includes('No matching validators.')`)
  await evaluate(`window.confirm = () => false; validatorPage.shadowRoot.querySelector('button').click()`)
  assert.equal(await evaluate(`participationCalls`), 0)
  await evaluate(`window.confirm = () => true;
    client.participate = () => { participationCalls++; return new Promise(resolve => { globalThis.resolveParticipation = resolve }) };
    validatorPage.shadowRoot.querySelector('button').click();
    validatorPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`globalThis.resolveParticipation && validatorPage.participating`)
  assert.equal(await evaluate(`participationCalls`), 1)
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelector('button').disabled`), true)
  await evaluate(`resolveParticipation(false)`)
  await waitFor(`!validatorPage.participating && validatorPage.message.includes('Registration submitted')`)
  await evaluate(`client.participate = async () => { participationCalls++; return true };
    validatorPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`!validatorPage.participating && validatorPage.message.includes('Participation enabled')`)
  await evaluate(`client.participate = async () => { throw new Error('Insufficient stake') };
    validatorPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`validatorPage.shadowRoot.querySelector('[role="alert"]')`)
  assert.match(await evaluate(`validatorPage.error`), /Insufficient stake/)
  await evaluate(`client.participate = async () => undefined;
    validatorPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`validatorPage.error.includes('unknown participation status')`)
  await evaluate(`client.staticCall = async () => ({ invalid: true }); await validatorPage.refresh()`)
  assert.match(await evaluate(`validatorPage.error`), /invalid validator list/)
  await evaluate(`client.staticCall = async () => []; await validatorPage.refresh()`)
  await waitFor(`validatorPage.shadowRoot.querySelector('.empty')`)
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelectorAll('.metric strong')[1].textContent.trim()`), 'Not registered')
  await evaluate(`client.staticCall = async () => validatorAddresses; await validatorPage.refresh()`)
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await evaluate(`getComputedStyle(validatorPage.shadowRoot.querySelector('.spark')).animationName`), 'none')
  for (const width of [1280, 390, 320]) {
    await resize(width)
    assert.equal(await evaluate(`validatorPage.scrollWidth <= validatorPage.clientWidth`), true, `validator overflow at ${width}`)
  }
  await evaluate(`client.staticCall = async () => { throw new Error('Registry unavailable') }; await validatorPage.refresh()`)
  assert.match(await evaluate(`validatorPage.error`), /Registry unavailable/)
  assert.deepEqual(errors, [])
})

test('explorer dashboard wires holder rankings and responsive activity cards', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, errors } = await createShellFixture(t)
  await evaluate(`globalThis.fixtureClient = client;
    globalThis.balanceReads = 0;
    globalThis.client = {
      lookup: async name => ({ address: name }),
      staticCall: async (address, method) => method === 'validators' ? {} : 0,
      nativeTransfers: async () => 0, nativeBurns: async () => 0, nativeMints: async () => 0,
      nativeCalls: async () => 0, totalContracts: async () => 0, lastBlockHeight: async () => 0,
      totalTransactions: async () => 0, totalSize: async () => 0,
      transactionsInPool: async () => 0, transactionPoolSize: async () => 0,
      peers: async () => [], blocks: async amount => { if (amount !== -128) throw new Error('Unbounded read'); return [] },
      balances: async () => { balanceReads++; return { Alice: 2000000000000000000n, Bob: 1000000000000000000n } },
      pubsub: fixtureClient.pubsub || pubsub
    };
    await import('/explorer-dashboard.js');
    pubsub.publish('node:ready', true);
    globalThis.rankDashboard = document.createElement('explorer-dashboard');
    rankDashboard.nodeStarted = true;
    rankDashboard.isNodeReady = true;
    shell.shadowRoot.querySelector('#main-content').replaceChildren(rankDashboard);
    undefined`)
  await waitFor(`rankDashboard.shadowRoot.querySelector('explorer-dashboard-rankings')?.shadowRoot?.querySelector('ol')`)
  assert.equal(await evaluate(`balanceReads`), 1)
  await evaluate(`globalThis.rankCards = rankDashboard.shadowRoot.querySelector('explorer-dashboard-rankings'); undefined`)
  assert.equal(await evaluate(`rankCards.shadowRoot.querySelector('ol li .address').textContent`), 'Alice')
  assert.match(await evaluate(`rankCards.shadowRoot.querySelector('ol li strong').textContent`), /^2(?:\.0+)? LFC$/)
  assert.equal(await evaluate(`rankCards.shadowRoot.textContent.includes('No contract calls in this sample.')`), true)
  await evaluate(`rankCards.activity = {
    blocks: 128, start: 10, end: 137,
    contracts: [{ address: 'TokenContract', count: 12, callers: 3 }],
    addresses: [{ address: 'Alice', count: 7 }]
  }; await rankCards.updateComplete`)
  assert.equal(await evaluate(`rankCards.shadowRoot.textContent.includes('128 sampled blocks')`), true)
  assert.equal(await evaluate(`rankCards.shadowRoot.textContent.includes('12 calls')`), true)
  await evaluate(`rankCards.holders = { total: 1, holders: [{
    address: 'YTqyQkkaMKMTShz7LQh8XdxdZ2GPsXkd1bYHpqQWEF7tQy12345678',
    balance: 5000226027397260273972572n, share: 100
  }] }; await rankCards.updateComplete`)
  assert.equal(await evaluate(`rankCards.shadowRoot.querySelector('ol li strong').textContent`), '5,000,226.0273… LFC')
  assert.equal(await evaluate(`rankCards.shadowRoot.querySelector('ol li strong').title`), '5000226.027397260273972572 LFC')
  assert.equal(await evaluate(`rankCards.shadowRoot.querySelector('ol li .address').textContent.length <= 22`), true)
  await evaluate(`globalThis.alignmentCharts = document.createElement('explorer-dashboard-charts');
    rankCards.before(alignmentCharts); undefined`)
  for (const width of [1600, 1280, 390]) {
    await resize(width)
    await evaluate(`new Promise(requestAnimationFrame)`)
    assert.equal(await evaluate(`rankCards.scrollWidth <= rankCards.clientWidth`), true)
    assert.equal(await evaluate(`(() => {
      const ranks = rankCards.shadowRoot.querySelector('.rankings').getBoundingClientRect();
      const charts = alignmentCharts.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(alignmentCharts).paddingLeft);
      return Math.abs(ranks.left - charts.left - padding) < 1 &&
        Math.abs(ranks.right - charts.right + padding) < 1;
    })()`), true, `Ranking cards must align with chart content at ${width}px`)
  }
  await evaluate(`alignmentCharts.remove()`)
  await evaluate(`client.balances = async () => { throw new Error('Balance lookup failed') }; await rankDashboard.updateInfo()`)
  await waitFor(`rankCards.shadowRoot.querySelector('[role="alert"]')`)
  assert.equal(await evaluate(`rankCards.shadowRoot.querySelector('[role="alert"]').textContent.includes('Balance lookup failed')`), true)
  assert.deepEqual(errors, [])
})

test('explorer block details show encoded size, transactions, recovery and latest selection', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { BlockMessage } = await import('@leofcoin/messages')
  const block = {
    index: 594n, previousHash: 'previous-block-hash', timestamp: Date.now(),
    fees: 123456789012345678n, reward: 2000000000000000000n,
    producer: 'producer-address', producerProof: '', protocolVersion: '1',
    validators: [{ address: 'validator-address', reward: 2000000000000000000n }],
    transactions: [{
      from: 'sender-address', to: 'contract-address', method: 'transfer',
      params: ['recipient-address', '100'], timestamp: Date.now(), signature: ''
    }]
  }
  const encoded = new BlockMessage(block).encode()
  const empty = new BlockMessage({ ...block, index: 0n, previousHash: '', transactions: [], validators: [] }).encode()
  const { evaluate, waitFor, resize, errors } = await createShellFixture(t)
  await evaluate(`globalThis.blockBytes = new Uint8Array(${JSON.stringify([...encoded])});
    globalThis.emptyBlockBytes = new Uint8Array(${JSON.stringify([...empty])});
    globalThis.peernet = { get: async () => blockBytes };
    await import('/explorer-block.js');
    globalThis.blockPage = document.createElement('explorer-block');
    shell.shadowRoot.querySelector('#main-content').replaceChildren(blockPage);
    blockPage.selected = 'fixture-block'; undefined`)
  await waitFor(`blockPage.block && blockPage.shadowRoot.querySelector('table')`)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelector('h1').textContent`), 'Block #594')
  assert.equal(await evaluate(`blockPage.size`), encoded.byteLength)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelector('tbody tr').textContent.includes('transfer')`), true)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelector('tbody tr').textContent.includes('sender-address')`), true)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelectorAll('.metrics article').length`), 4)
  assert.equal(await evaluate(`blockPage.shadowRoot.textContent.includes('fees burnt')`), false)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelector('nav a:last-child').getAttribute('href')`),
    '#!/explorer/block?selected=previous-block-hash')
  await evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async value => { globalThis.copiedBlockValue = value }
  } });
  blockPage.shadowRoot.querySelector('[aria-label="Copy block hash"]').click()`)
  await waitFor(`blockPage.copyStatus === 'Block hash copied.'`)
  assert.equal(await evaluate(`copiedBlockValue === blockPage.hash`), true)
  await evaluate(`navigator.clipboard.writeText = async () => { throw new Error('Permission denied') };
    blockPage.shadowRoot.querySelector('[aria-label="Copy block hash"]').click()`)
  await waitFor(`blockPage.copyStatus.includes('Permission denied')`)
  for (const width of [1280, 390, 320]) {
    await resize(width)
    assert.equal(await evaluate(`blockPage.scrollWidth <= blockPage.clientWidth`), true,
      `Block details overflow at ${width}px`)
  }
  await evaluate(`peernet.get = async () => undefined; blockPage.selected = 'missing-block'`)
  await waitFor(`blockPage.shadowRoot.querySelector('[role="alert"]')`)
  assert.equal(await evaluate(`blockPage.shadowRoot.textContent.includes('Block not found.')`), true)
  await evaluate(`peernet.get = async () => { throw new Error('Peer unavailable') }; blockPage.selected = 'failed-block'`)
  await waitFor(`blockPage.error === 'Peer unavailable' && blockPage.shadowRoot.querySelector('[role="alert"]')`)
  assert.equal(await evaluate(`blockPage.shadowRoot.textContent.includes('Peer unavailable')`), true)
  await evaluate(`peernet.get = async () => emptyBlockBytes;
    blockPage.shadowRoot.querySelector('[role="alert"] button').click()`)
  await waitFor(`blockPage.block && blockPage.shadowRoot.textContent.includes('No transactions')`)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelectorAll('nav a').length`), 1)
  assert.equal(await evaluate(`blockPage.shadowRoot.textContent.includes('No validators recorded')`), true)
  await evaluate(`peernet.get = hash => hash === 'slow' ? new Promise(resolve => { globalThis.resolveSlowBlock = resolve })
    : Promise.resolve(blockBytes); blockPage.selected = 'slow'`)
  await waitFor(`globalThis.resolveSlowBlock`)
  await evaluate(`blockPage.selected = 'newer'`)
  await waitFor(`blockPage.block && blockPage.shadowRoot.querySelector('h1').textContent === 'Block #594'`)
  await evaluate(`resolveSlowBlock(emptyBlockBytes); new Promise(resolve => setTimeout(resolve, 50))`)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelector('h1').textContent`), 'Block #594')
  assert.deepEqual(errors, [])
})

test('node activity dashboard shows real observed traffic, filters and sync status', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, errors } = await createShellFixture(t)
  await evaluate(`shell.shadowRoot.querySelector('a[data-route="stats"]').click()`)
  await waitFor(`shell.currentRoute === 'stats' && shell.shadowRoot.querySelector('stats-view')?.shadowRoot`)
  assert.equal(await evaluate(`location.hash`), '#!/stats')
  await evaluate(`globalThis.activity = shell.shadowRoot.querySelector('stats-view');
    globalThis.requestResult = Promise.resolve(new Uint8Array(7));
    globalThis.peernet = {
      connections: { 'activity-peer': { id: 'activity-peer', connected: true, request: () => requestResult } },
      _protoHandler: message => message,
      sendMessage: () => Promise.resolve('id')
    }; undefined`)
  await waitFor(`activity.nodeStatus.peers.includes('activity-peer')`)
  await evaluate(`activity.shadowRoot.querySelectorAll('button')[1].click();
    peernet.connections['activity-peer'].request(new Uint8Array(4));
    peernet._protoHandler({ proto: { name: 'peernet-data', encoded: new Uint8Array(9) } }, { id: 'activity-peer' }, 'activity-peer');
    peernet.sendMessage({ id: 'activity-peer' }, 'id', new Uint8Array(5));
    fetch('/not-an-endpoint?token=do-not-retain')`)
  await waitFor(`activity.snapshot.totals.outgoing >= 3 && activity.snapshot.totals.errors >= 1`)
  assert.equal(await evaluate(`activity.snapshot.events.some(event => event.transport === 'HTTP' && event.outcome === 'error')`), true)
  assert.equal(await evaluate(`activity.shadowRoot.textContent.includes('do-not-retain')`), false)
  await evaluate(`activity.shadowRoot.querySelector('[aria-label="Traffic transport"]').value = 'P2P';
    activity.shadowRoot.querySelector('[aria-label="Traffic transport"]').dispatchEvent(new Event('change'))`)
  await waitFor(`activity.transport === 'P2P'`)
  assert.equal(await evaluate(`Array.from(activity.shadowRoot.querySelectorAll('tbody tr')).every(row => row.cells[2].textContent === 'P2P')`), true)
  await evaluate(`activity.shadowRoot.querySelector('[aria-label="Traffic direction"]').value = 'in';
    activity.shadowRoot.querySelector('[aria-label="Traffic direction"]').dispatchEvent(new Event('change'))`)
  await waitFor(`activity.direction === 'in'`)
  assert.equal(await evaluate(`activity.shadowRoot.querySelectorAll('tbody tr').length`), 2)
  await evaluate(`activity.shadowRoot.querySelectorAll('button')[0].click()`)
  await waitFor(`activity.paused`)
  const count = await evaluate(`activity.snapshot.totals.incoming`)
  await evaluate(`peernet._protoHandler({ proto: { name: 'peernet-data', encoded: new Uint8Array(9) } }, {}, 'activity-peer')`)
  await new Promise((resolve) => setTimeout(resolve, 1100))
  assert.equal(await evaluate(`activity.snapshot.totals.incoming`), count)
  await evaluate(`activity.shadowRoot.querySelectorAll('button')[0].click()`)
  await waitFor(`activity.snapshot.totals.incoming > ${count}`)
  await evaluate(`pubsub.publish('sync-progress', { startIndex: 100, localIndex: 150, targetIndex: 200 });
    chain.state.sync = 'syncing'`)
  await waitFor(`activity.nodeStatus.progress === 50 && activity.nodeStatus.local === 150`)
  assert.equal(await evaluate(`activity.shadowRoot.querySelector('progress').value`), 50)
  await resize(390)
  assert.equal(await evaluate(`activity.scrollWidth <= activity.clientWidth`), true)
  await evaluate(`activity.shadowRoot.querySelectorAll('button')[1].click()`)
  await waitFor(`activity.snapshot.events.length === 0`)
  assert.deepEqual(errors, [])
})

test('bottom status bar shows sync, peers and blocks across views and screen sizes', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, call, errors } = await createShellFixture(t)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('header .sync-status-pill') === null`), true)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('wallet-view').shadowRoot.querySelector('wallet-send').shadowRoot.querySelector('.network') === null`), true)
  await waitFor(`shell.connectedPeers === 1 && shell.isNodeReady`)
  await evaluate(`shell.chainId = 'lfc:fixture-chain-id'; await shell.rendered`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.extra-nav-rail').textContent.includes('Chain ID')`), false)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.extra-nav-rail code') === null`), true)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.node-status-bar').textContent.includes('Node synced')`), true)
  await evaluate(`shell.lastBlockIndex = 123; await shell.rendered`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.block-status').textContent`), '#123')
  await evaluate(`shell.shadowRoot.querySelector('.node-status-bar button').click()`)
  await waitFor(`shell.shadowRoot.querySelector('sync-info')?.open`)
  await evaluate(`shell.shadowRoot.querySelector('sync-info').dispatchEvent(new CustomEvent('sync-info-close'))`)
  await waitFor(`!shell.syncInfoOpen`)
  await evaluate(`chain.state.sync = 'syncing'; shell.syncTargetIndex = 200; shell.syncStartIndex = 100`)
  await waitFor(`!shell.isNodeReady && shell.syncLabel === 'Syncing 23%'`)
  await evaluate(`peernet.connections.fixture.connected = false`)
  await waitFor(`shell.connectedPeers === 0 && shell.syncLabel === 'Waiting for peers'`)
  await evaluate(`shell.nodeStartError = 'Fixture node failed'; await shell.rendered`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.sync-status-pill').dataset.state`), 'error')
  await evaluate(`shell.nodeStartError = ''; shell.nodeStarted = false; await shell.rendered`)
  assert.equal(await evaluate(`shell.syncLabel`), 'Wallet locked')
  await evaluate(`await shell.select('address-book')`)
  for (const width of [1280, 390, 320]) {
    await resize(width)
    await call('Runtime.evaluate', { expression: 'new Promise(requestAnimationFrame)', awaitPromise: true })
    assert.equal(await evaluate(`(() => {
      const bar = shell.shadowRoot.querySelector('.node-status-bar')
      const rect = bar.getBoundingClientRect()
      const content = shell.shadowRoot.querySelector('#main-content').getBoundingClientRect()
      const drawer = shell.shadowRoot.querySelector('#app-navigation').getBoundingClientRect()
      return Math.abs(rect.left) < 1 && Math.abs(rect.right - innerWidth) < 1
        && Math.abs(rect.bottom - innerHeight) < 1
        && (!shell.isDesktop || drawer.bottom <= rect.top + 1)
        && content.bottom <= rect.top + 1 && bar.scrollWidth <= bar.clientWidth
    })()`), true, `status bar layout at ${width}px`)
  }
  await evaluate(`shell.shadowRoot.querySelector('.menu-toggle').click()`)
  await waitFor(`shell.drawerOpen`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.node-status-bar').inert`), true)
  await evaluate(`shell.shadowRoot.querySelector('.drawer-close').click()`)
  await waitFor(`!shell.drawerOpen`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.node-status-bar').inert`), false)
  assert.deepEqual(errors, [])
})

test('drawer address book CRUD and searchable recipient dialog', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, click, call, errors } = await createShellFixture(t)
  await evaluate(`globalThis.walletView = shell.shadowRoot.querySelector('wallet-view');
    globalThis.cachedSendView = walletView.shadowRoot.querySelector('wallet-send'); undefined`)
  const assertRecipientPicker = async () => {
    assert.equal(await evaluate(`(() => {
      const button = cachedSendView.shadowRoot.querySelector('.recipient-picker')
      const input = cachedSendView.shadowRoot.querySelector('#recipient-address')
      const buttonRect = button.getBoundingClientRect()
      const inputRect = input.getBoundingClientRect()
      return button.getAttribute('aria-label') === 'Choose from address book'
        && Boolean(button.querySelector('svg'))
        && buttonRect.width >= 44 && buttonRect.height >= 44
        && buttonRect.left > inputRect.left && buttonRect.right <= inputRect.right
        && buttonRect.top >= inputRect.top && buttonRect.bottom <= inputRect.bottom
        && parseFloat(getComputedStyle(input).paddingRight) >= buttonRect.width
    })()`), true)
  }
  await assertRecipientPicker()
  assert.equal(await evaluate(`cachedSendView.shadowRoot.querySelector('form') === null`), true)
  await evaluate(`cachedSendView.to = 'manual-address'; cachedSendView.amount = '1.25';
    shell.shadowRoot.querySelector('a[data-route="address-book"]').click()`)
  await waitFor(`shell.currentRoute === 'address-book' && shell.shadowRoot.querySelector('address-book-view')?.shadowRoot`)
  assert.equal(await evaluate(`location.hash`), '#!/address-book')
  assert.equal(await evaluate(`Boolean(shell.shadowRoot.querySelector('address-book-view').shadowRoot.querySelector('.hero-art[aria-hidden="true"]'))`), true)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('a[data-route="address-book"]').getAttribute('aria-current')`), 'page')
  await evaluate(`globalThis.book = shell.shadowRoot.querySelector('address-book-view');
    book.shadowRoot.querySelector('[aria-label="Contact name"]').value = 'Alice';
    book.shadowRoot.querySelector('[aria-label="Contact name"]').dispatchEvent(new Event('input'));
    Array.from(book.shadowRoot.querySelectorAll('button')).find(button => button.textContent === 'Use my address').click();
    await book.updateComplete;
    book.shadowRoot.querySelector('form').requestSubmit()`)
  await waitFor(`book.contacts.length === 1 && !book.saving`)
  assert.equal(await evaluate(`book.contacts[0].address === shell.wallet.selectedAccount`), true)
  await evaluate(`book.shadowRoot.querySelector('[aria-label="Rename Alice"]').click()`)
  await waitFor(`book.shadowRoot.querySelector('[aria-label="Rename contact"]')`)
  await evaluate(`book.shadowRoot.querySelector('[aria-label="Rename contact"]').value = 'Alice Wallet';
    book.shadowRoot.querySelector('[aria-label="Rename contact"]').dispatchEvent(new Event('input'));
    book.shadowRoot.querySelector('.contact form').requestSubmit()`)
  await waitFor(`book.contacts[0].name === 'Alice Wallet' && !book.editingAddress`)
  await evaluate(`shell.shadowRoot.querySelector('a[data-route="wallet"]').click()`)
  await waitFor(`shell.currentRoute === 'wallet' && walletView.shadowRoot.querySelector('wallet-send') === cachedSendView`)
  await click(`cachedSendView.shadowRoot.querySelector('[aria-haspopup="dialog"]')`)
  await waitFor(`cachedSendView.shadowRoot.querySelector('dialog').open && cachedSendView.contacts.length === 1`)
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await evaluate(`getComputedStyle(cachedSendView.shadowRoot.querySelector('dialog')).animationName`), 'none')
  await call('Emulation.setEmulatedMedia', { features: [] })
  assert.equal(await evaluate(`cachedSendView.shadowRoot.querySelector('dialog .contact-choice strong').textContent`), 'Alice Wallet')
  await evaluate(`cachedSendView.shadowRoot.querySelector('[aria-label="Search contacts"]').value = 'missing';
    cachedSendView.shadowRoot.querySelector('[aria-label="Search contacts"]').dispatchEvent(new Event('input'))`)
  await waitFor(`!cachedSendView.shadowRoot.querySelector('.contact-choice')`)
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor(`!cachedSendView.shadowRoot.querySelector('dialog').open`)
  assert.equal(await evaluate(`cachedSendView.to`), 'manual-address')
  assert.equal(await evaluate(`cachedSendView.shadowRoot.activeElement.getAttribute('aria-haspopup')`), 'dialog')
  await evaluate(`cachedSendView.shadowRoot.querySelector('[aria-haspopup="dialog"]').click()`)
  await waitFor(`cachedSendView.shadowRoot.querySelector('.contact-choice')`)
  await evaluate(`cachedSendView.shadowRoot.querySelector('.contact-choice').click()`)
  await waitFor(`!cachedSendView.shadowRoot.querySelector('dialog').open`)
  assert.equal(await evaluate(`cachedSendView.to === shell.wallet.selectedAccount`), true)
  assert.equal(await evaluate(`cachedSendView.amount`), '1.25')
  assert.equal(await evaluate(`cachedSendView.shadowRoot.activeElement.getAttribute('aria-label')`), 'Recipient address')

  await resize(390)
  await waitFor(`!shell.isDesktop`)
  await click(`shell.shadowRoot.querySelector('.menu-toggle')`)
  await waitFor(`shell.drawerOpen`)
  await click(`shell.shadowRoot.querySelector('a[data-route="address-book"]')`)
  await waitFor(`shell.currentRoute === 'address-book' && book.isConnected && !shell.drawerOpen`)
  assert.equal(await evaluate(`book.scrollWidth <= book.clientWidth`), true)
  await evaluate(`globalThis.savedConfirm = window.confirm;
    window.confirm = () => false;
    book.shadowRoot.querySelector('[aria-label="Remove Alice Wallet"]').click();
    window.confirm = savedConfirm`)
  assert.equal(await evaluate(`book.contacts.length`), 1)
  await evaluate(`window.confirm = () => true;
    book.shadowRoot.querySelector('[aria-label="Remove Alice Wallet"]').click();
    window.confirm = savedConfirm`)
  await waitFor(`book.contacts.length === 0`)
  await click(`shell.shadowRoot.querySelector('.menu-toggle')`)
  await waitFor(`shell.drawerOpen`)
  await click(`shell.shadowRoot.querySelector('a[data-route="wallet"]')`)
  await waitFor(`shell.currentRoute === 'wallet' && cachedSendView.isConnected && !shell.drawerOpen`)
  await assertRecipientPicker()
  await click(`cachedSendView.shadowRoot.querySelector('[aria-haspopup="dialog"]')`)
  await waitFor(`cachedSendView.shadowRoot.querySelector('dialog').open && cachedSendView.contacts.length === 0`)
  assert.equal(await evaluate(`cachedSendView.shadowRoot.querySelector('dialog').textContent.includes('No saved contacts yet')`), true)
  assert.equal(await evaluate(`cachedSendView.shadowRoot.querySelector('dialog').getBoundingClientRect().right <= innerWidth`), true)
  await evaluate(`cachedSendView.shadowRoot.querySelector('dialog a').click()`)
  await waitFor(`shell.currentRoute === 'address-book' && !cachedSendView.shadowRoot.querySelector('dialog').open`)
  assert.deepEqual(errors, [])
})
