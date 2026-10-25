import { html, css, LiteElement, property, customElement, map } from '@vandeurenglenn/lite'
import { render } from 'lit-html'
import generateAccount from '@leofcoin/generate-account'
import IdentityController from '../controllers/identity.js'
import { bindWalletToNode } from '../controllers/wallet-bootstrap.js'
import { getSelectedNetwork, installNetworkStoreScope } from '../network-selection.js'
import '@material/web/button/elevated-button.js'
import networks from '@leofcoin/networks'
import QrScanner from 'qr-scanner'
import { decrypt, encrypt } from '@leofcoin/identity-utils'
import base58 from '@vandeurenglenn/base58'
import type Client from '@leofcoin/endpoint-clients/direct'
import type Chain from '@leofcoin/chain/chain'
import Router from '../router.js'
import './../elements/hero.js'
import '@vandeurenglenn/lite-elements/button.js'
import '@vandeurenglenn/lite-elements/tabs.js'
import '@vandeurenglenn/lite-elements/pages.js'
import '@vandeurenglenn/lite-elements/tab.js'
import '@vandeurenglenn/flex-elements/wrap-between.js'

declare global {
  var client: Client
  var chain: Chain
}
@customElement('login-screen')
export class LoginScreen extends LiteElement {
  @property({ type: Boolean, reflect: true })
  accessor shown: boolean
  @property()
  accessor mnemonic: string
  @property({ type: Boolean })
  accessor hasWallet: boolean
  @property()
  accessor importing: boolean
  @property()
  accessor headline
  @property()
  accessor subline
  @property() accessor loginError = ''
  @property({ type: Boolean }) accessor busy = false

  @property()
  accessor decodedMnemonic: string
  @property({ type: Boolean })
  accessor mnemonicShowed: boolean

  @property({ type: Boolean })
  accessor passwordShowed: boolean

  #viewPassword: () => void

  disconnectedCallback() {
    this.shadowRoot.querySelector('input:focus')?.blur()
    super.disconnectedCallback()
  }

  async getIdentity() {
    if (!globalThis.walletStore) {
      if (!globalThis.LeofcoinStorage) {
        const storage = (await import('@leofcoin/storage')).default
        globalThis.LeofcoinStorage = globalThis.LeofcoinStorage || storage
      }
      globalThis.walletStore = new LeofcoinStorage('wallet')
    }
  }
  async _hasWallet() {
    const has = await globalThis.walletStore?.has('identity')
    console.log(has)

    return has as boolean
  }

  get #pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  _keydown({ key, code, keyCode, ctrlKey, altKey, shiftKey }) {
    if (key === 'Enter' && !this.busy) {
      this.shadowRoot.querySelector(`[data-route-action="${this.hasWallet ? 'login' : 'create'}"]`)?.click()
    }
  }

  async requestLogin(hasWallet) {
    return new Promise(async (resolve, reject) => {
      this.addEventListener('keydown', this._keydown)
      this.shown = true
      this.hasWallet = await this._hasWallet()
      if (this.hasWallet) {
        this.headline = 'Welcome back!'
        this.subline = 'Enter password to unlock wallet'
      } else {
        this.headline = 'Welcome!'
        this.subline = 'Create a wallet or import one to continue'
      }
      await this.requestRender()
      const onClick = async (event) => {
        const target = event.composedPath().find((element: any) => element?.dataset?.routeAction) as HTMLElement
        const routeAction = target?.dataset.routeAction
        if (!routeAction || this.busy) return
        const password = this.shadowRoot.querySelector<HTMLInputElement>('.wallet-password').value
        try {
          this.busy = true
          this.loginError = ''
          if (routeAction) {
            if (routeAction !== 'login' && password.length < 8)
              throw new Error('Use a password with at least 8 characters.')
            if (routeAction === 'create') await this.#handleCreate(password)
            if (routeAction === 'import') await this.#handleImport(password)
            if (routeAction === 'login') await this.#handleLogin(password)
            this.removeEventListener('click', onClick)
            resolve()
          }
        } catch (error) {
          this.loginError =
            error instanceof Error ? error.message : 'Could not unlock the wallet. Check your password or backup.'
        } finally {
          this.busy = false
        }
      }
      this.addEventListener('click', onClick)
    })
  }

  async requestPassword(hasWallet) {
    this.headline = 'Encrypt your backup'
    this.subline = 'Keep this password and the encrypted backup safely. Both are needed to restore.'
    this.shown = true
    await this.requestRender()
    this.#pages.select('backup')
    const section = this.shadowRoot.querySelector('[data-route="backup"]')
    const input = section.querySelector('input')
    input.focus()
    return new Promise((resolve) => {
      const button = section.querySelector('button')
      button.onclick = () => {
        if (input.value.length < 8) {
          this.loginError = 'Use a password with at least 8 characters.'
          return
        }
        const password = input.value
        input.value = ''
        input.blur()
        this.shown = false
        this.loginError = ''
        button.onclick = null
        resolve(password)
      }
    })
  }

  async #handleBeforeLogin(password) {
    this.shadowRoot.querySelector<HTMLInputElement>('.wallet-password').value = null
    let wallet
    const { network } = getSelectedNetwork()
    this.hasWallet = await this._hasWallet()

    if (!this.hasWallet && !this.importing) {
      wallet = await generateAccount(password, network)
      await globalThis.walletStore.put('identity', JSON.stringify(wallet.identity))
      await globalThis.walletStore.put('accounts', JSON.stringify(wallet.accounts))
      await globalThis.walletStore.put('selectedAccount', wallet.accounts[0][1])
      await globalThis.walletStore.put('selectedAccountIndex', '0')
    } else if (this.hasWallet) {
      const identity = JSON.parse(await new TextDecoder().decode(await globalThis.walletStore.get('identity')))
      const accounts = JSON.parse(await new TextDecoder().decode(await globalThis.walletStore.get('accounts')))
      const selectedAccount = await new TextDecoder().decode(await globalThis.walletStore.get('selectedAccount'))
      const selectedAccountIndex = Number(
        await new TextDecoder().decode(await globalThis.walletStore.get('selectedAccountIndex'))
      )
      wallet = { identity, accounts, selectedAccount, selectedAccountIndex }
    }
    wallet.selectedAccountIndex = Number.isInteger(wallet.selectedAccountIndex) ? wallet.selectedAccountIndex : 0
    wallet.selectedAccount = wallet.selectedAccount || wallet.accounts[wallet.selectedAccountIndex][1]
    globalThis.identityController = new IdentityController(network, wallet)
    return wallet
  }

  async #handleAfterLogin(wallet) {
    document.querySelector('app-shell').wallet = wallet

    this.removeEventListener('keydown', this._keydown)

    if (!this.hasWallet) {
      location.hash = Router.bang('identity/dashboard')
    }
    document.querySelector('app-shell').navRailShown = true
    pubsub.publish('identity-change', {
      accounts: wallet.accounts,
      selectedAccount: wallet.selectedAccount,
      selectedAccountIndex: wallet.selectedAccountIndex
    })
  }

  #iUnderstand = () => {
    if (this.mnemonicShowed && this.passwordShowed) this.#dismiss()
  }

  #dismiss() {
    this.shadowRoot.querySelector('input:focus')?.blur()
    this.shown = false
    this.dispatchEvent(new CustomEvent('login-dismiss', { bubbles: true, composed: true }))
  }

  async #handleCreate(password) {
    const wallet = await this.#handleBeforeLogin(password)

    try {
      await globalThis.identityController.unlock(password)
      this.mnemonic = wallet.identity.mnemonic
      this.decodedMnemonic = await decrypt(password, base58.decode(wallet.identity.mnemonic))
      this.#viewPassword = () => this.#viewPasswordMethod(password)
      this.headline = 'Wallet created'
      this.subline = 'Back up your recovery phrase and password before continuing.'
      this.shadowRoot.querySelector('input:focus')?.blur()
      this.#pages.select('create')
      await this.#handleAfterLogin(wallet)
      this.loadChain(password)
    } catch (e) {
      console.error(e)
      throw e
    }
  }

  #waitForKey = () =>
    new Promise((resolve, reject) => {
      const importSection = this.shadowRoot.querySelector('[data-route="import"]')

      const _onImport = (result) => {
        resolve(importSection.querySelector('input').value)

        importSection.querySelector('custom-button').removeEventListener('click', _onImport)
      }
      importSection.querySelector('custom-button').addEventListener('click', _onImport)
    })

  async #handleImport(password) {
    this.importing = true
    this.shadowRoot.querySelector('input:focus')?.blur()
    this.#pages.select('import')
    this.headline = 'Import Wallet!'
    this.subline = 'Paste your encrypted identity backup to restore the wallet'
    const encrypted = await this.#waitForKey()
    try {
      const identityController = new IdentityController(getSelectedNetwork().network)

      let wallet = await identityController.import(password, encrypted)
      const multiWIF = new Uint8Array(await encrypt(password, await wallet.multiWIF))

      const external = await wallet.account(1).external(1)
      const externalAddress = await external.address
      const internal = await wallet.account(1).internal(1)
      const internalAddress = await internal.address

      wallet = {
        identity: {
          multiWIF: base58.encode(multiWIF),
          walletId: await external.id
        },
        accounts: [['main account', externalAddress, internalAddress]]
      }
      await globalThis.walletStore.put('identity', JSON.stringify(wallet.identity))
      await globalThis.walletStore.put('accounts', JSON.stringify(wallet.accounts))
      await globalThis.walletStore.put('selectedAccount', wallet.accounts[0][1])
      await globalThis.walletStore.put('selectedAccountIndex', '0')
      this.importing = false
      await this.#handleLogin(password)
    } catch (error) {
      console.error(error)
      this.importing = false
      this.shadowRoot.querySelector('input:focus')?.blur()
      this.#pages.select('login')
      throw error
    }
  }

  async #spawnChain(password) {
    console.time('loading chain')
    const network = getSelectedNetwork()
    if (!globalThis.accountStore) {
      const Storage = (await import('@leofcoin/storage')).default
      globalThis.accountStore = new Storage(`account-${network.key}`, network.storageRoot)
      await globalThis.accountStore.init()
      Object.assign(globalThis, { [`account-${network.key}Store`]: globalThis.accountStore })
    }
    await bindWalletToNode(document.querySelector('app-shell').wallet, globalThis.walletStore, globalThis.accountStore)
    let importee
    const nodeBrowserUrl = new URL('./chain/node-browser.js', document.baseURI).href
    importee = await import(nodeBrowserUrl)
    installNetworkStoreScope(network.key)
    await new importee.default(
      {
        network: network.network,
        networkName: network.network,
        networkVersion: network.networkVersion,
        stars: networks.leofcoin[network.key].stars,
        autoStart: false
      },
      password
    )

    importee = await import('@leofcoin/lib/node-config')
    const config = await importee.default()

    const chainUrl = new URL('./chain/chain.js', document.baseURI).href
    importee = await import(chainUrl)
    globalThis.chain = await new importee.default({ resolveTimeout: 30_000 })
    let timer
    try {
      await Promise.race([
        globalThis.chain.ready,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Browser node startup timed out. Reload to try again.')), 30_000)
        })
      ])
    } finally {
      clearTimeout(timer)
    }
    console.timeEnd('loading chain')
    await this.#spawnEndpoint()
    // await globalThis.client.init()
  }

  async #spawnEndpoint(direct = true) {
    const { networkVersion } = getSelectedNetwork()
    let importee
    if (direct) {
      importee = await import('@leofcoin/endpoint-clients/direct')
      globalThis.client = await new importee.default('wss://ws-remote.leofcoin.org', networkVersion)
    } else {
      importee = await import('@leofcoin/endpoint-clients/ws')
      globalThis.client = await new importee.default('wss://ws-remote.leofcoin.org', networkVersion)
      // @ts-ignore
      globalThis.client.init && (await globalThis.client.init())
    }
  }

  async loadChain(password, direct = true) {
    if (globalThis.chain) return
    pubsub.publish('node:starting', true)
    try {
      if (direct) await this.#spawnChain(password)
      else await this.#spawnEndpoint(false)
    } catch (error) {
      console.log(error)
      pubsub.publish('node:start-error', error instanceof Error ? error.message : String(error))
      // A remote client cannot stand in for this wallet's local signer,
      // state and canonical confirmation handle. Keep the error visible.
    }
  }

  async #handleLogin(password) {
    const wallet = await this.#handleBeforeLogin(password)

    try {
      await globalThis.identityController.unlock(password)

      await this.#handleAfterLogin(wallet)
      this.#dismiss()
      this.loadChain(password)
    } catch (e) {
      console.error(e)
      throw e
    }
  }
  // Password managers only treat a field as a login when it sits in a real form with a username.
  #preventSubmit = (event: SubmitEvent) => event.preventDefault()

  get #walletUsername() {
    return html`<input
      class="wallet-username"
      type="text"
      name="username"
      value="Leofcoin wallet"
      autocomplete="username"
      readonly
      tabindex="-1"
      aria-hidden="true" />`
  }

  get #defaultTemplate() {
    return html`
      <form class="entry-form" method="post" action="#" @submit=${this.#preventSubmit}>
        ${this.#walletUsername}
        <input
          class="wallet-password"
          type="password"
          name="new-password"
          placeholder="Choose a wallet password"
          aria-label="Wallet password"
          tabindex="0"
          autocomplete="new-password" />
        <div class="entry-actions">
          <button class="secondary-button" type="button" data-route-action="import">Import wallet</button>
          <button class="primary-button" type="submit" data-route-action="create">Create wallet</button>
        </div>
      </form>
    `
  }

  get #hasWalletTemplate() {
    return html`
      <form class="entry-form" method="post" action="#" @submit=${this.#preventSubmit}>
        ${this.#walletUsername}
        <input
          class="wallet-password"
          type="password"
          name="current-password"
          placeholder="Wallet password"
          aria-label="Wallet password"
          tabindex="0"
          autocomplete="current-password" />
        <button class="primary-button" type="submit" data-route-action="login">Unlock wallet</button>
      </form>
    `
  }

  static styles = [
    css`
      :host {
        display: flex;
        flex-direction: column;
        position: fixed;
        inset: 0;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        opacity: 0;
        background: rgb(10 12 17 / 72%);
        backdrop-filter: blur(10px);
        transition: opacity 180ms ease, background 180ms ease;
        z-index: -1;
      }

      :host([shown]) {
        opacity: 1;
        pointer-events: auto;
        z-index: 1200;
      }

      hero-element {
        width: min(420px, calc(100vw - 32px));
        height: auto;
        max-width: 420px;
        max-height: calc(100vh - 32px);
        min-height: min(360px, calc(100vh - 32px));
        overflow-y: auto;
        box-sizing: border-box;
        padding: 24px 28px 28px;
        border-radius: 28px;
        border-color: color-mix(in srgb, var(--md-sys-color-primary) 34%, transparent);
        background:
          radial-gradient(ellipse at 100% 0%, color-mix(in srgb, var(--md-sys-color-primary) 22%, transparent), transparent 45%),
          radial-gradient(ellipse at 0% 100%, color-mix(in srgb, var(--md-sys-color-tertiary) 12%, transparent), transparent 48%),
          color-mix(in srgb, var(--md-sys-color-surface-container-high, #292f39) 92%, transparent);
        -webkit-backdrop-filter: blur(28px) saturate(1.4);
        backdrop-filter: blur(28px) saturate(1.4);
        box-shadow:
          0 24px 80px rgb(0 0 0 / 42%),
          0 0 48px color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent),
          inset 0 1px rgb(255 255 255 / 12%);
      }

      hero-element.welcome-dialog {
        --md-sys-color-outline: color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
      }

      hero-element input {
        appearance: none;
        -webkit-appearance: none;
        box-sizing: border-box;
        min-height: 48px;
        margin: 0;
        border: 1px solid var(--md-sys-color-outline-variant);
        border-radius: 14px;
        color: var(--md-sys-color-on-surface);
        background: color-mix(in srgb, var(--md-sys-color-surface-container) 84%, transparent);
        padding: 13px 15px;
        transition: border-color 160ms ease, box-shadow 160ms ease;
      }

      input::placeholder {
        color: var(--md-sys-color-on-surface-variant);
        opacity: .78;
      }

      input:focus-visible {
        border-color: var(--md-sys-color-primary);
        outline: 2px solid color-mix(in srgb, var(--md-sys-color-primary) 32%, transparent);
        outline-offset: 1px;
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
      }

      hero-element custom-pages {
        height: 100%;
      }

      button {
        min-height: 48px;
        border: 1px solid transparent;
        border-radius: 14px;
        box-sizing: border-box;
        pointer-events: auto;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        transition: transform 140ms ease, background 140ms ease, box-shadow 140ms ease;
      }

      input {
        width: 100%;
        font-size: 16px;
      }

      .entry-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        width: 100%;
        margin-top: 8px;
      }

      .primary-button {
        padding: 11px 18px;
        color: var(--lfc-on-action, #ffffff);
        background: var(--lfc-action, #1d64d8);
        box-shadow: none;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.01em;
        -webkit-font-smoothing: antialiased;
      }

      .primary-button:hover {
        background: var(--lfc-action-hover, #1652b5);
        box-shadow: 0 2px 8px rgb(29 100 216 / 18%);
      }

      .secondary-button {
        padding: 11px 14px;
        border-color: var(--md-sys-color-outline-variant);
        color: var(--md-sys-color-on-surface);
        background: color-mix(in srgb, var(--md-sys-color-surface-container-high) 70%, transparent);
      }

      button:active {
        transform: translateY(1px) scale(.99);
      }

      button:focus-visible {
        outline: 2px solid var(--md-sys-color-primary);
        outline-offset: 3px;
      }

      .login-error {
        width: 100%;
        margin: 0;
        color: var(--md-sys-color-error);
        font-size: 13px;
      }

      custom-pages {
        width: 100%;
        height: 100%;
      }

      flex-column[data-route='login'] {
        display: flex;
        width: 100%;
        min-height: 150px;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }

      flex-column[data-route='login'] > flex-it {
        display: none;
      }

      .entry-form {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        width: 100%;
        margin: 0;
      }

      .entry-form > .primary-button {
        width: 100%;
      }

      hero-element input.wallet-username {
        position: absolute;
        width: 1px;
        height: 1px;
        min-height: 0;
        padding: 0;
        border: 0;
        opacity: 0;
        overflow: hidden;
        pointer-events: none;
        clip-path: inset(50%);
      }

      [data-route='create'] {
        min-height: 270px;
        align-items: stretch;
        justify-content: flex-start;
        gap: 4px;
      }

      flex-row {
        width: 100%;
        align-items: center;
        justify-content: space-between;
      }

      custom-button[type='text'] {
        --custom-button-color: var(--md-sys-color-primary);
      }

      .create-item {
        align-items: center;
        gap: 12px;
        padding: 4px 0;
      }

      .step-marker {
        display: grid;
        width: 30px;
        height: 30px;
        flex: 0 0 30px;
        place-items: center;
        border: 1px solid rgb(255 255 255 / 24%);
        border-radius: 50%;
        color: var(--md-sys-color-primary, #3477d2);
      }

      .step-marker[data-complete] {
        color: var(--md-sys-color-on-primary);
        background: var(--md-sys-color-primary);
        border-color: var(--md-sys-color-primary);
      }

      .backup-guide {
        display: grid;
        grid-template-columns: 48px 1fr;
        align-items: center;
        gap: 10px;
        margin: 2px 0 8px;
        padding: 10px;
        border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 22%, transparent);
        border-radius: 16px;
        background: color-mix(in srgb, var(--md-sys-color-primary) 7%, transparent);
      }

      .backup-guide svg {
        width: 48px;
        height: 48px;
        color: var(--md-sys-color-primary, #3477d2);
      }

      .backup-guide p {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
      }

      @media (max-width: 480px) {
        hero-element {
          padding: 20px 20px 24px;
          border-radius: 22px;
        }
        .entry-actions { gap: 8px; }
        .entry-actions button { padding-inline: 8px; font-size: 13px; }
      }
    `
  ]

  #viewMnemonic() {
    const words = this.decodedMnemonic?.trim().split(/\s+/).filter(Boolean)
    if (!words?.length) {
      this.loginError = 'The recovery phrase is unavailable. Unlock the wallet and try again.'
      return
    }

    const dialog = document.createElement('dialog')
    document.body.appendChild(dialog)
    dialog.innerHTML = `
      <custom-tabs>
        <custom-tab type="round" data-route="json">JSON</custom-tab>
        <custom-tab type="round" data-route="string">String</custom-tab>
        <custom-tab type="round" data-route="encrypted">Encrypted</custom-tab>
      </custom-tabs>
      <custom-pages attr-for-selected="data-route">
        <flex-wrap-between data-route="json">
          ${map(
            words,
            (word, index) =>
              `<flex-row class="word">
                <strong>${index + 1}</strong>
                <p>${word}</p></flex-row
              >`
          ).join('')}
        </flex-wrap-between>
        <flex-column data-route="string">
          <p>${this.decodedMnemonic}</p>
        </flex-column>

        <flex-column data-route="encrypted">
          <h2>Encrypted</h2>
          <p>This is the encrypted version of your mnemonic, requiring your password to unlock.</p>
          <p>${this.mnemonic}</p>
        </flex-column>
      </custom-pages>

      <button type="button">scroll down</button>
    `

    dialog.style.cssText =
      'position:fixed;inset:50% auto auto 50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;margin:0;box-sizing:border-box;padding:24px;border:1px solid var(--md-sys-color-outline-variant);border-radius:24px;color:var(--md-sys-color-on-surface);background:var(--md-sys-color-surface-container-high);box-shadow:0 24px 80px rgb(0 0 0 / 48%)'
    dialog.dataset.walletBackup = 'recovery-phrase'
    dialog.showModal()

    const container = dialog.querySelector('custom-pages').querySelector('flex-wrap-between')
    const confirmButton = dialog.querySelector('button')
    confirmButton.style.cssText =
      'display:block;margin:16px auto 0;padding:10px 20px;border:1px solid transparent;border-radius:999px;color:var(--lfc-on-action,#ffffff);background:var(--lfc-action,#1d64d8);font:inherit;font-weight:700;cursor:pointer'
    container.style.maxHeight = 'min(60vh, 320px)'
    container.style.overflowY = 'auto'
    container.style.overscrollBehavior = 'contain'
    container.tabIndex = 0
    container.setAttribute('aria-label', 'Recovery phrase')
    const isAtEnd = () => container.scrollTop + container.clientHeight >= container.scrollHeight - 1
    const updateConfirmLabel = () => {
      if (isAtEnd()) confirmButton.textContent = 'confirm'
    }
    container.addEventListener('scroll', updateConfirmLabel, { passive: true })
    const removeDialog = () => {
      dialog.removeEventListener('close', removeDialog)
      container.removeEventListener('scroll', updateConfirmLabel)
      confirmButton.onclick = null
      dialog.remove()
    }
    const ondialogClick = () => {
      if (isAtEnd()) {
        this.mnemonicShowed = true
        dialog.close()
        removeDialog()
      } else {
        container.scrollTop = Math.min(
          container.scrollTop + Math.max(1, container.clientHeight - 8),
          container.scrollHeight
        )
        updateConfirmLabel()
      }
    }

    dialog.addEventListener('close', removeDialog, { once: true })
    confirmButton.onclick = ondialogClick
  }

  #viewPasswordMethod = (password: string) => {
    const dialog = document.createElement('dialog')
    document.body.appendChild(dialog)
    dialog.innerHTML = `
        <p></p>
        <button type="button">confirm</button>
      `

    dialog.style.cssText =
      'position:fixed;inset:50% auto auto 50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;margin:0;box-sizing:border-box;padding:24px;border:1px solid var(--md-sys-color-outline-variant);border-radius:24px;color:var(--md-sys-color-on-surface);background:var(--md-sys-color-surface-container-high);box-shadow:0 24px 80px rgb(0 0 0 / 48%)'
    dialog.querySelector('p').textContent = password
    dialog.querySelector('p').style.cssText = 'overflow-wrap:anywhere;user-select:text'
    dialog.dataset.walletBackup = 'password'
    dialog.showModal()

    const confirmButton = dialog.querySelector('button')
    confirmButton.style.cssText =
      'display:block;margin:16px auto 0;padding:10px 20px;border:1px solid transparent;border-radius:999px;color:var(--lfc-on-action,#ffffff);background:var(--lfc-action,#1d64d8);font:inherit;font-weight:700;cursor:pointer'
    const ondialogClick = () => {
      this.passwordShowed = true
      dialog.close()
      removeDialog()
    }

    const removeDialog = () => {
      dialog.removeEventListener('close', removeDialog)
      confirmButton.onclick = null
      dialog.remove()
    }
    dialog.addEventListener('close', removeDialog, { once: true })
    confirmButton.onclick = ondialogClick
  }

  render() {
    return html`
      <hero-element
        class="welcome-dialog"
        .brand=${true}
        .headline=${this.headline}
        .subline=${this.subline}>
        ${this.loginError ? html`<p class="login-error" role="alert">${this.loginError}</p>` : ''}
        ${this.busy ? html`<p role="status">Working…</p>` : ''}
        <custom-pages attr-for-selected="data-route">
          <flex-column data-route="login" center>
            <flex-it flex="2"></flex-it>
            ${this.hasWallet ? this.#hasWalletTemplate : this.#defaultTemplate}
          </flex-column>

          <flex-column data-route="create">
            <div class="backup-guide">
              <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
                <path d="M32 5 53 13v16c0 13-8.7 23.8-21 30C19.7 52.8 11 42 11 29V13L32 5Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
                <path d="m23 31 6 6 13-14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M21 15h22" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/>
              </svg>
              <p>Keep both recovery details somewhere private. You’ll need them to restore access to this wallet.</p>
            </div>
            <flex-row class="create-item">
              <span class="step-marker" data-complete=${this.mnemonicShowed} aria-hidden="true">
                ${this.mnemonicShowed ? '✓' : '1'}
              </span>
              <custom-button
                @click=${() => this.#viewMnemonic()}
                label="view recovery phrase"></custom-button>
            </flex-row>

            <flex-row class="create-item">
              <span class="step-marker" data-complete=${this.passwordShowed} aria-hidden="true">
                ${this.passwordShowed ? '✓' : '2'}
              </span>
              <custom-button
                @click=${() => this.#viewPassword()}
                label="view wallet password"></custom-button>
            </flex-row>
            <custom-button
              type="outlined"
              label="I Understand"
              @click=${this.#iUnderstand}
              ?disabled=${!this.mnemonicShowed || !this.passwordShowed}></custom-button>
          </flex-column>

          <flex-column data-route="import">
            <flex-column data-route="qr"> </flex-column>

            <input type="password" placeholder="multiwif" tabindex="0" autocomplete="off" />

            <custom-button type="outlined" label="import"></custom-button>
          </flex-column>
          <flex-column data-route="backup">
            <label>Backup password<input type="password" autocomplete="new-password" /></label>
            <button type="button">Export encrypted backup</button>
          </flex-column>
        </custom-pages>
      </hero-element>
    `
  }
}
