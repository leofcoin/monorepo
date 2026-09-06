import Pubsub from '@vandeurenglenn/little-pubsub'
import Storage from '@leofcoin/storage'
import '@vandeurenglenn/lite-elements/pages.js'
import '@vandeurenglenn/lite-elements/selector.js'
import './array-repeat.js'
import './screens/login.js'
import './screens/export.js'
import './clipboard-copy.js'
import './screens/login.js'
import './notification/controller.js'
import './notification/child.js'
import './elements/account-select.js'
import '@vandeurenglenn/lite-elements/icon-set.js'
import '@vandeurenglenn/lite-elements/icon.js'
import '@vandeurenglenn/lite-elements/dropdown-menu.js'
import '@vandeurenglenn/flex-elements/column.js'
import '@vandeurenglenn/flex-elements/row.js'
import '@vandeurenglenn/flex-elements/it.js'
import '@vandeurenglenn/lite-elements/theme.js'
import './elements/sync-info.js'
import Router from './router.js'
import { CustomPages } from '@vandeurenglenn/lite-elements/pages.js'

import { LiteElement, property, query, css, html, customElement } from '@vandeurenglenn/lite'
import { NotificationController } from './notification/controller.js'

interface SyncProgress {
  phase: 'syncing' | 'synced'
  startIndex: number
  localIndex: number
  targetIndex: number
}

globalThis.pubsub = globalThis.pubsub || new Pubsub(true)

declare global {
  var walletStore: Storage
}

@customElement('app-shell')
class AppShell extends LiteElement {
  @property({ provides: true }) accessor blocks

  @property({ type: Number, provides: true })
  accessor lastBlockIndex = 0

  @property({ type: Number, provides: true })
  accessor totalResolved = 0

  @property({ type: Number, provides: true })
  accessor totalLoaded = 0

  @property({ type: Boolean, provides: true })
  accessor isNodeReady = false

  @property({ type: Boolean, provides: true })
  accessor nodeStarted = false

  @property({ type: String, provides: true })
  accessor nodeStartError = ''

  @property({ type: Number, provides: true })
  accessor syncStartIndex = 0

  @property({ type: Number, provides: true })
  accessor syncTargetIndex = 0

  @property({ type: Boolean, reflect: true })
  accessor navRailShown = false

  router: Router

  @property({ provides: true })
  accessor block

  @property({ provides: true })
  accessor wallet

  @property({ type: Boolean, reflect: true, attribute: 'sync-animating' })
  accessor syncAnimating

  totalResolvedtimeout: number

  onChange(name) {
    if (name === 'totalResolved' || name === 'totalLoaded') {
      if (this.totalResolved === 0) return
      this.syncAnimating = true
      if (this.totalResolvedtimeout) clearTimeout(this.totalResolvedtimeout)
      this.totalResolvedtimeout = setTimeout(() => {
        this.syncAnimating = false
      }, 1000)
    }
  }

  get nodeReady() {
    return this.#nodeReady
  }

  get syncPercent() {
    const total = this.syncTargetIndex - this.syncStartIndex
    if (total <= 0) return this.isNodeReady ? 100 : 0
    const completed = this.lastBlockIndex - this.syncStartIndex
    return Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
  }

  get syncLabel() {
    if (this.nodeStartError) return 'Node unavailable'
    if (!this.nodeStarted) return 'Wallet locked'
    if (this.isNodeReady) return 'Node synced'
    if (!this.syncTargetIndex) return 'Connecting...'
    return `Syncing ${this.syncPercent}%`
  }

  #nodeReady = new Promise((resolve) => {
    pubsub.subscribe('node:ready', () => {
      this.isNodeReady = true
      resolve(true)
    })
  })

  get notificationController() {
    return this.shadowRoot.querySelector('notification-controller') as NotificationController
  }
  get #pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  select(selected) {
    console.log({ selected })

    return this.#select(selected)
  }

  @query('custom-pages')
  accessor pages: CustomPages

  async #select(selected) {
    if (!customElements.get(`${selected}-view`)) await import(`./${selected}.js`)
    let pages = this.#pages
    for (let attempt = 0; !pages && attempt < 10; attempt += 1) {
      await new Promise(requestAnimationFrame)
      pages = this.#pages
    }
    if (!pages) throw new Error('application navigation did not render')
    pages.select(selected)
    const login = this.shadowRoot.querySelector('login-screen')
    if (login && !this.wallet) login.shown = selected === 'wallet' || selected === 'identity'
    const monacoContainer = document.querySelector('.container')
    if (monacoContainer) {
      if (selected === 'editor') monacoContainer.classList.add('custom-selected')
      else monacoContainer.classList.remove('custom-selected')
    }
  }

  @query('sync-info')
  accessor syncInfo

  @query('notification-controller')
  accessor notifications: NotificationController

  @property({ type: Boolean, reflect: true, attribute: 'is-desktop' })
  accessor isDesktop: boolean = false

  #matchMedia = ({ matches }) => {
    this.isDesktop = matches
    document.dispatchEvent(new CustomEvent('is-desktop', { detail: matches }))
    return matches
  }

  async connectedCallback() {
    super.connectedCallback()
    this.router = new Router(this, 'wallet')
    var matchMedia = window.matchMedia('(min-width: 640px)')
    this.#matchMedia(matchMedia)
    matchMedia.onchange = this.#matchMedia(matchMedia)

    pubsub.subscribe('lastBlock', (block) => (this.lastBlockIndex = block.index))
    pubsub.subscribe('node:starting', () => {
      this.nodeStarted = true
      this.nodeStartError = ''
    })
    pubsub.subscribe('node:start-error', (message) => (this.nodeStartError = message))
    pubsub.subscribe('sync-progress', ({ startIndex, localIndex, targetIndex }: SyncProgress) => {
      this.syncStartIndex = startIndex
      this.lastBlockIndex = localIndex
      this.syncTargetIndex = targetIndex
    })
    // todo check if our address is in the block
    pubsub.subscribe('block-resolved', (block) => (this.totalResolved += 1))
    pubsub.subscribe('block-loaded', (block) => {
      this.totalLoaded += 1
      this.lastBlockIndex = Number(block.index)
    })
    try {
      let importee
      importee = await import('@leofcoin/endpoint-clients/ws')
      globalThis.client = await new importee.default('wss://ws-remote.leofcoin.org', 'peach')
      console.log(client)

      // @ts-ignore
      globalThis.client.init && (await globalThis.client.init())
      console.log('client init')
    } catch (error) {
      console.error(error)
    }

    this.#login()
    import('./integrations/nfc.js')
    // await this.init()
    // globalThis.walletStorage = new Storage('wallet')
    // await globalThis.walletStorage.init()
    // lo
  }

  async #login() {
    if (!globalThis.walletStore) {
      const importee = await import('@leofcoin/storage')
      // todo: race condition introduced?
      // for some reason walletStore can't find current wallet
      globalThis.walletStore = globalThis.walletStore || (await new Storage('wallet', '.leofcoin/peach'))
      await walletStore.init()
    }

    console.log('wallet')
    console.log(walletStore)

    const hasWallet = await walletStore.has('identity')
    console.log(hasWallet)

    await this.shadowRoot.querySelector('login-screen').requestLogin(hasWallet)
  }

  static styles = [
    css`
      :host {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        font-family: var(--lfc-font-family);
        background: var(--md-sys-background);
        font-size: 0.875rem;
        font-weight: 400;
        line-height: 1.5;
      }

      .container {
        height: 100%;
      }

      .main {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        top: 0;
      }

      custom-selector {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .custom-selector-overlay {
        height: 100%;
        width: var(--lfc-navigation-width);
        --svg-icon-color: var(--md-sys-color-on-surface-variant);
        border-right: 1px solid var(--md-sys-color-outline-variant);
        background: var(--md-sys-color-surface-container);
        position: relative;
        top: 0;
        left: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        flex: 0 0 var(--lfc-navigation-width);
        box-sizing: border-box;
        z-index: 1003;
      }

      .brand {
        height: 72px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 20px;
        color: var(--md-sys-color-on-surface);
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0;
      }

      .brand-mark {
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border-radius: var(--md-sys-shape-corner-medium);
        background: var(--md-sys-color-primary);
        color: var(--md-sys-color-on-primary);
        font-size: 15px;
        font-weight: 800;
      }

      :host([sync-animating]) custom-icon-button[icon='sync'] {
        animation-name: spin;
        animation-duration: 4000ms;
        animation-iteration-count: infinite;
        animation-timing-function: linear;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      a {
        padding: 0 14px;
        box-sizing: border-box;
        height: 44px;
        margin: 2px 10px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-radius: var(--md-sys-shape-corner-medium);
        color: var(--md-sys-color-on-surface-variant);
        text-decoration: none;
        font-weight: 600;
      }

      a:hover {
        background: var(--md-sys-color-surface-container-high);
      }

      a.custom-selected {
        background: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-on-primary-container);
        --svg-icon-color: var(--md-sys-color-on-primary-container);
      }

      .nav-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .extra-nav-rail {
        align-items: center;
        box-sizing: border-box;
        padding: 10px;
        gap: 4px;
      }

      .sync-status-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        border-radius: 999px;
        border: 1px solid var(--border-color);
        background: var(--md-sys-color-surface-container-high);
        color: var(--md-sys-color-on-surface);
        padding: 6px 10px;
        margin-right: 12px;
      }

      .sync-status-pill[data-state='syncing'] {
        border-color: var(--md-sys-color-primary);
      }

      .sync-status-pill[data-state='ready'] {
        border-color: var(--md-sys-color-secondary);
      }

      header {
        min-height: 72px;
        display: flex;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        padding: 10px 24px;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
        background: var(--md-sys-color-surface);
      }

      .page-heading {
        display: flex;
        flex-direction: column;
      }

      .page-title {
        color: var(--md-sys-color-on-surface);
        font-size: 18px;
        line-height: 24px;
        font-weight: 700;
      }

      .page-subtitle {
        color: var(--md-sys-color-on-surface-variant);
        font-size: 12px;
        line-height: 18px;
      }

      @media (max-width: 639px) {
        .container {
          flex-direction: column-reverse;
        }

        .custom-selector-overlay {
          width: 100%;
          height: 64px;
          flex: 0 0 64px;
          border-right: 0;
          border-top: 1px solid var(--md-sys-color-outline-variant);
        }

        .brand,
        .extra-nav-rail,
        .nav-label,
        a[data-secondary] {
          display: none;
        }

        custom-selector {
          flex-direction: row;
          justify-content: space-around;
        }

        a {
          width: 56px;
          height: 48px;
          justify-content: center;
          margin: 8px 2px;
          padding: 0;
        }

        header {
          min-height: 64px;
          padding: 8px 12px;
        }

        .page-subtitle {
          display: none;
        }

        .sync-status-pill {
          margin-right: 6px;
        }
      }

      ::slotted(.container) {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }

      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.3);
        -webkit-box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.3);
        border-radius: 10px;
      }
      ::-webkit-scrollbar-thumb {
        border-radius: 10px;
        box-shadow: inset 0 0 6px rgba(225, 255, 255, 0.5);
        -webkit-box-shadow: inset 0 0 6px rgba(225, 255, 255, 0.5);
      }

      .resolver-snack,
      .loader-snack {
        color: var(--font-color);
      }
    `
  ]
  render() {
    return html`
      <custom-icon-set>
        <template>
          <span name="add">@symbol-add</span>
          <span name="arrow_drop_down">@symbol-arrow_drop_down</span>
          <span name="arrow_drop_up">@symbol-arrow_drop_up</span>
          <span name="close">@symbol-close</span>
          <span name="notifications">@symbol-notifications</span>
          <span name="menu_open">@symbol-menu_open</span>
          <span name="sync">@symbol-sync</span>
          <span name="clear-all">@symbol-clear_all</span>
          <span name="wallet">@symbol-wallet</span>
          <span name="dashboard">@symbol-dashboard</span>
          <span name="accounts">@symbol-account_tree</span>
          <span name="actions">@symbol-manage_accounts</span>
          <span name="stack">@symbol-stack</span>
          <span name="pool">@symbol-pool</span>
          <span name="send">@symbol-send</span>
          <span name="account_circle">@symbol-account_circle</span>
          <span name="travel_explore">@symbol-travel_explore</span>
          <span name="gavel">@symbol-gavel</span>
          <span name="edit_note">@symbol-edit_note</span>
          <span name="analytics">@symbol-analytics</span>
          <span name="chat">@symbol-chat</span>
          <span name="database">@symbol-database</span>
          <span name="history">@symbol-history</span>
          <span name="mood">@symbol-mood</span>
          <span name="local-florist">@symbol-local_florist</span>
          <span name="local-pizza">@symbol-local_pizza</span>
          <span name="directions-walk">@symbol-directions_walk</span>
          <span name="input_circle">@symbol-input_circle</span>
          <span name="cake">@symbol-cake</span>
          <span name="account-balance">@symbol-account_balance</span>
          <span name="euro-symbol">@symbol-euro_symbol</span>
          <span name="gif">@symbol-gif</span>
          <span name="list">@symbol-list_alt</span>
          <span name="call_received">@symbol-call_received</span>
          <span name="call_made">@symbol-call_made</span>
          <span name="share">@symbol-share</span>
          <span name="content_copy">@symbol-content_copy</span>
          <span name="square">@symbol-square</span>
          <span name="check_box_outline_blank">@symbol-check_box_outline_blank</span>
          <span name="check_box">@symbol-check_box</span>
          <span name="mode_heat">@symbol-mode_heat</span>
          <span name="playing_cards">@symbol-playing_cards</span>
          <span name="published_with_changes">@symbol-published_with_changes</span>
          <span name="storage">@symbol-storage</span>
          <span name="speed">@symbol-speed</span>
          <span name="groups">@symbol-groups</span>
          <span name="network_check">@symbol-network_check</span>
          <span name="analytics">@symbol-analytics</span>
          <span name="construction">@symbol-construction</span>
          <span name="contract">@symbol-contract</span>
        </template>
      </custom-icon-set>
      <custom-theme load-symbols="false"></custom-theme>
      <flex-row class="container">
        <span class="custom-selector-overlay">
          <div class="brand"><span class="brand-mark">L</span><span>Leofcoin</span></div>
          <custom-selector attr-for-selected="data-route">
            <a href="#!/wallet" data-route="wallet">
              <custom-icon icon="wallet"></custom-icon>
              <span class="nav-label">Wallet</span>
            </a>
            <a href="#!/identity" data-route="identity">
              <custom-icon icon="account_circle"></custom-icon>
              <span class="nav-label">Identity</span>
            </a>
            <a href="#!/explorer" data-route="explorer">
              <custom-icon icon="travel_explore"></custom-icon>
              <span class="nav-label">Explorer</span>
            </a>
            <a href="#!/validator" data-route="validator">
              <custom-icon icon="gavel"></custom-icon>
              <span class="nav-label">Validator</span>
            </a>
            <a href="#!/editor" data-route="editor" data-secondary>
              <custom-icon icon="edit_note"></custom-icon>
              <span class="nav-label">Contracts</span>
            </a>
            <a href="#!/chat" data-route="chat" data-secondary>
              <custom-icon icon="chat"></custom-icon>
              <span class="nav-label">Chat</span>
            </a>
            <a href="#!/database" data-route="database" data-secondary>
              <custom-icon icon="database"></custom-icon>
              <span class="nav-label">Database</span>
            </a>
            <a href="#!/stats" data-route="stats" data-secondary>
              <custom-icon icon="analytics"></custom-icon>
              <span class="nav-label">Statistics</span>
            </a>
          </custom-selector>

          <flex-column class="extra-nav-rail">
            <custom-divider></custom-divider>
            <custom-icon-button
              icon="notifications"
              @click=${() => (this.notifications.open = !this.notifications.open)}></custom-icon-button>
            <custom-icon-button
              icon="sync"
              @click=${() => (this.syncInfo.open = !this.syncInfo.open)}></custom-icon-button>
          </flex-column>
        </span>

        <flex-column class="main">
          <header>
            <span class="page-heading">
              <span class="page-title">Node console</span>
              <span class="page-subtitle">Peach network</span>
            </span>
            <flex-it></flex-it>
            <span
              class="sync-status-pill"
              data-state=${this.nodeStartError ? 'error' : this.isNodeReady ? 'ready' : 'syncing'}>
              <custom-icon
                icon=${this.nodeStartError ? 'error' : this.isNodeReady ? 'check_box' : 'sync'}></custom-icon>
              ${this.syncLabel}
            </span>
            <account-select></account-select>
          </header>
          <custom-pages attr-for-selected="data-route">
            <identity-view data-route="identity"></identity-view>
            <wallet-view data-route="wallet"></wallet-view>
            <explorer-view data-route="explorer"></explorer-view>
            <validator-view data-route="validator"></validator-view>
            <editor-view data-route="editor"><slot></slot></editor-view>
            <stats-view data-route="stats"></stats-view>
            <chat-view data-route="chat" ?is-desktop=${this.isDesktop}></chat-view>
          </custom-pages>
        </flex-column>
      </flex-row>

      <login-screen></login-screen>
      <export-screen></export-screen>

      <notification-controller></notification-controller>
      <sync-info></sync-info>
    `
  }
}
export default AppShell
