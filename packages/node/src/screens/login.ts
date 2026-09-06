import { html, css, LiteElement, property, customElement, map } from '@vandeurenglenn/lite'
import { render } from 'lit-html'
import generateAccount from '@leofcoin/generate-account'
import IdentityController from '../controllers/identity.js'
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
import '@vandeurenglenn/lite-elements/toggle-button.js'
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

  @property()
  accessor decodedMnemonic: string
  @property({ type: Boolean })
  accessor mnemonicShowed: boolean

  @property({ type: Boolean })
  accessor passwordShowed: boolean

  #viewPassword: () => void

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
    if (key === 'Enter') this.shadowRoot.querySelector('[data-route-action="login"]').click()
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
      this.shadowRoot.querySelector('input').focus()
      this.addEventListener('click', async (event) => {
        const target = event.composedPath()[0]
        const routeAction = target.dataset.routeAction
        const password = this.shadowRoot.querySelector('input').value
        try {
          if (routeAction) {
            console.log(routeAction)

            if (routeAction === 'create') await this.#handleCreate(password)
            if (routeAction === 'import') await this.#handleImport(password)
            if (routeAction === 'login') await this.#handleLogin(password)
            resolve()
          }
        } catch {}
      })
    })
  }

  async requestPassword(hasWallet) {
    return new Promise(async (resolve, reject) => {
      this.addEventListener('keydown', this._keydown)
      this.shown = true
      this.shadowRoot.querySelector('input').focus()
      this.addEventListener('click', async (event) => {
        const target = event.composedPath()[0]
        const routeAction = target.dataset.routeAction
        const password = this.shadowRoot.querySelector('input').value
        try {
          if (routeAction) {
            resolve(password)
          }
        } catch {}
      })
    })
  }

  async #handleBeforeLogin(password) {
    this.shadowRoot.querySelector('input').value = null
    let wallet
    this.hasWallet = await this._hasWallet()

    if (!this.hasWallet && !this.importing) {
      wallet = await generateAccount(password, 'leofcoin:peach')
      globalThis.walletStore.put('identity', JSON.stringify(wallet.identity))
      globalThis.walletStore.put('accounts', JSON.stringify(wallet.accounts))
      globalThis.walletStore.put('selectedAccount', wallet.accounts[0][1])
      globalThis.walletStore.put('selectedAccountIndex', '0')
    } else if (this.hasWallet) {
      const identity = JSON.parse(await new TextDecoder().decode(await globalThis.walletStore.get('identity')))
      const accounts = JSON.parse(await new TextDecoder().decode(await globalThis.walletStore.get('accounts')))
      const selectedAccount = await new TextDecoder().decode(await globalThis.walletStore.get('selectedAccount'))
      const selectedAccountIndex = Number(
        await new TextDecoder().decode(await globalThis.walletStore.get('selectedAccountIndex'))
      )
      wallet = { identity, accounts, selectedAccount, selectedAccountIndex }
    }
    globalThis.identityController = new IdentityController('leofcoin:peach', wallet)
    return wallet
  }

  async #handleAfterLogin(wallet) {
    document.querySelector('app-shell').wallet = wallet

    if (!customElements.get('identity-view')) await import('../views/identity.js')
    const identityView = document.querySelector('app-shell').shadowRoot.querySelector('identity-view')
    identityView.identity = wallet.identity
    identityView.accounts = wallet.accounts
    identityView.selectedAccount = wallet.selectedAccount
    identityView.selectedAccountIndex = isNaN(Number(wallet.selectedAccountIndex))
      ? wallet.accounts.filter(([name, external, internal]) => external === wallet.selectedAccount)[0]
      : wallet.selectedAccountIndex

    // this.hasWallet = await this._hasWallet()
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
    this.mnemonicShowed && this.passwordShowed && this.removeAttribute('shown')
  }

  async #handleCreate(password) {
    const wallet = await this.#handleBeforeLogin(password)
    console.log({ wallet })

    this.headline = 'Created Wallet!'
    this.subline = 'Make sure to backup your password and mnemonic'
    this.#pages.select('create')
    try {
      await globalThis.identityController.unlock(password)
      await this.#handleAfterLogin(wallet)
      this.mnemonic = wallet.identity.mnemonic
      this.decodedMnemonic = await decrypt(password, base58.decode(wallet.identity.mnemonic))
      this.#viewPassword = () => this.#viewPasswordMethod(password)
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

        importSection.querySelector('md-elevated-button').removeEventListener('click', _onImport)
      }
      importSection.querySelector('md-elevated-button').addEventListener('click', _onImport)
      new QrScanner(this.shadowRoot.querySelector('video'), (decoded) => {
        importSection.querySelector('input').value = decoded
      })
    })

  async #handleImport(password) {
    this.importing = true
    this.#pages.select('import')
    this.headline = 'Import Wallet!'
    this.subline = 'Scan qr code or putin multiWIF'
    const encrypted = await this.#waitForKey()
    try {
      const identityController = new IdentityController('leofcoin:peach')

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
      globalThis.walletStore.put('identity', JSON.stringify(wallet.identity))
      globalThis.walletStore.put('accounts', JSON.stringify(wallet.accounts))
      globalThis.walletStore.put('selectedAccount', wallet.accounts[0][1])
      globalThis.walletStore.put('selectedAccountIndex', '0')
    } catch (error) {
      console.error(error)
      alert(error)
    }
  }

  async #spawnChain(password) {
    console.time('loading chain')
    let importee
    importee = await import('/chain/node-browser.js')
    await new importee.default(
      {
        network: 'leofcoin:peach',
        networkName: 'leofcoin:peach',
        networkVersion: 'peach',
        stars: networks.leofcoin.peach.stars,
        autoStart: false
      },
      password
    )

    importee = await import('@leofcoin/lib/node-config')
    const config = await importee.default()

    importee = await import('/chain/chain.js')
    globalThis.chain = await new importee.default({ resolveTimeout: 30_000 })
    console.log(chain)
    console.timeEnd('loading chain')
    await this.#spawnEndpoint()
    // await globalThis.client.init()
  }

  async #spawnEndpoint(direct = true) {
    let importee
    if (direct) {
      importee = await import('@leofcoin/endpoint-clients/direct')
      globalThis.client = await new importee.default('wss://ws-remote.leofcoin.org', 'peach')
    } else {
      importee = await import('@leofcoin/endpoint-clients/ws')
      globalThis.client = await new importee.default('wss://ws-remote.leofcoin.org', 'peach')
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
      this.#spawnEndpoint(false)
    }
  }

  async #handleLogin(password) {
    const wallet = await this.#handleBeforeLogin(password)

    try {
      await globalThis.identityController.unlock(password)

      await this.#handleAfterLogin(wallet)
      this.removeAttribute('shown')
      this.loadChain(password)
    } catch (e) {
      console.error(e)
      throw e
    }
  }
  get #defaultTemplate() {
    return html`
      <input type="password" placeholder="password" tabindex="0" autofocus autocomplete="new-password" />
      <flex-it></flex-it>
      <flex-row>
        <custom-button type="outlined" data-route-action="import" label="import"></custom-button>
        <flex-it></flex-it>
        <custom-button type="outlined" data-route-action="create" label="create"></custom-button>
      </flex-row>
    `
  }

  get #hasWalletTemplate() {
    return html`
      <input type="password" placeholder="password" tabindex="0" autofocus autocomplete="current-password" />
      <flex-it></flex-it>
      <custom-button
        type="outlined"
        label="login"
        data-route-action="login"
        style="width: 100%; max-width: 190px; margin-bottom: 12px;"></custom-button>
    `
  }

  static styles = [
    css`
      :host {
        display: flex;
        flex-direction: column;
        inset: 0;
        position: absolute;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        opacity: 0;
        background: #1116;
        transition: 0.25s;
        z-index: -1;
      }

      :host([shown]) {
        opacity: 1;
        pointer-events: auto;
        z-index: 1002;
        transition: 0.25s;
      }

      input,
      button {
        border-color: white;
        padding: 10px;
        border-radius: 12px;
        box-sizing: border-box;
        pointer-events: auto;
      }

      input {
        font-size: 16px;
      }

      button {
        background: #12b8e4a3;
        color: white;
        border-color: white;
        background: transparent;
        padding: 10px 20px;
      }

      button:hover {
        background: var(--secondary-background);
        transition: 0.25s;
      }

      custom-pages {
        width: 100%;
        height: 100%;
      }

      span[data-route='login'] {
        display: flex;
        width: 100%;
        height: 100%;
        align-items: center;
        justify-content: center;
      }

      [data-route='create'] {
        align-items: flex-end;
      }

      flex-row {
        width: 100%;
      }

      custom-button[type='text'] {
        --custom-button-color: aqua;
      }

      custom-toggle-button {
        pointer-events: none !important;
      }

      .create-item {
        align-items: flex-end;
      }

      .create-item {
        pointer-events: auto;
        cursor: pointer;
      }
    `
  ]

  #viewMnemonic() {
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
            this.decodedMnemonic?.split(' '),
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

      <custom-button label="scroll down"></custom-button>
    `

    dialog.querySelector('custom-pages')
    dialog.setAttribute('id', 'dialog')
    dialog.setAttribute('popover', '')
    dialog.showPopover()
    dialog.dataset.id = crypto.randomUUID()

    const container = dialog.querySelector('custom-pages').querySelector('flex-wrap-between')
    const viewportHeight = container.getBoundingClientRect().height
    const ondialogClick = () => {
      if (container.scrollTop + viewportHeight === container.scrollHeight) {
        dialog.close()
        this.mnemonicShowed = true
        dialog.removeEventListener('click', ondialogClick)
        dialog.remove()
      } else {
        container.scrollBy({
          top: viewportHeight - 8,
          behavior: 'smooth'
        })

        container.onscrollend = () => {
          if (container.scrollTop + viewportHeight === container.scrollHeight) {
            dialog.querySelector('custom-button').label = 'confirm'
          }
        }
      }
    }

    dialog.querySelector('custom-button').addEventListener('click', ondialogClick)
  }

  #viewPasswordMethod = (password: string) => {
    const dialog = document.createElement('dialog')
    document.body.appendChild(dialog)
    dialog.innerHTML = `
        <p>${password}</p>
        <custom-button label="confirm"></custom-button>
      `

    dialog.setAttribute('id', 'dialog')
    dialog.setAttribute('popover', '')
    dialog.showPopover()
    dialog.dataset.id = crypto.randomUUID()

    const ondialogClick = () => {
      dialog.close()
      this.passwordShowed = true
      dialog.removeEventListener('click', ondialogClick)
      dialog.remove()
    }

    dialog.querySelector('custom-button').addEventListener('click', ondialogClick)
  }

  render() {
    return html`
      <hero-element .headline=${this.headline} .subline=${this.subline}>
        <custom-pages attr-for-selected="data-route">
          <flex-column data-route="login" center>
            <flex-it flex="2"></flex-it>
            ${this.hasWallet ? this.#hasWalletTemplate : this.#defaultTemplate}
          </flex-column>

          <flex-column data-route="create">
            <flex-it></flex-it>
            <flex-row class="create-item" @click=${() => this.#viewMnemonic()}>
              <custom-toggle-button
                .togglers=${['check_box_outline_blank', 'check_box']}
                .active=${this.mnemonicShowed ? 1 : 0}
                @active=${({ detail }) => (this.mnemonicShowed = detail === 1)}></custom-toggle-button>

              <custom-button
                @click=${() => this.#viewMnemonic()}
                label="view mnemonic"
                popovertarget="dialog"></custom-button>
            </flex-row>

            <flex-row class="create-item" @click=${() => this.#viewPassword()}>
              <custom-toggle-button
                .togglers=${['check_box_outline_blank', 'check_box']}
                .active=${this.passwordShowed ? 1 : 0}
                @active=${({ detail }) => (this.passwordShowed = detail === 1)}></custom-toggle-button>

              <custom-button
                @click=${() => this.#viewPassword()}
                label="view password"
                popovertarget="dialog"></custom-button>
            </flex-row>
            <flex-it></flex-it>
            <custom-button
              type="outlined"
              label="I Understand"
              @click=${this.#iUnderstand}
              ?disabled=${!this.mnemonicShowed || !this.passwordShowed}></custom-button>
          </flex-column>

          <flex-column data-route="import">
            <flex-column data-route="qr">
              <video></video>
            </flex-column>

            <input type="password" placeholder="multiwif" tabindex="0" autofocus autocomplete="new-password" />

            <custom-button type="outlined" label="import"></custom-button>
          </flex-column>
        </custom-pages>
      </hero-element>
    `
  }
}
