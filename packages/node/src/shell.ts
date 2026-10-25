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

const navigation = [
  { route: 'wallet', label: 'Wallet', icon: 'wallet' },
  { route: 'identity', label: 'Identity', icon: 'account_circle' },
  { route: 'explorer', label: 'Explorer', icon: 'travel_explore' },
  { route: 'validator', label: 'Validator', icon: 'gavel' },
  { route: 'manager', label: 'Chain manager', icon: 'construction' },
  { route: 'editor', label: 'Contracts', icon: 'edit_note' },
  { route: 'chat', label: 'Chat', icon: 'chat' },
  { route: 'stats', label: 'Statistics', icon: 'analytics' }
]

interface SyncProgress {
  phase: 'syncing' | 'synced'
  startIndex: number
  localIndex: number
  targetIndex: number
}

interface CachedView extends HTMLElement {
  wallet?: unknown
  isDesktop?: boolean
}

interface LoginScreenElement extends HTMLElement {
  shown: boolean
  requestLogin(hasWallet: boolean): Promise<void>
  requestPassword(): Promise<string>
}

interface ExportScreenElement extends HTMLElement {
  show(qrcode: string, exported: string): void
}

interface SyncInfoElement extends HTMLElement {
  open: boolean
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
  #networkTimer: ReturnType<typeof setInterval>
  #loginRequested = false
  #viewHistory = new Map<string, CachedView>()
  #screenHistory = new Map<string, HTMLElement>()

  @property({ type: Number, provides: true })
  accessor syncStartIndex = 0

  @property({ type: Number, provides: true })
  accessor syncTargetIndex = 0

  @property({ type: Boolean, reflect: true })
  accessor navRailShown = false

  @property({ type: Boolean, reflect: true, attribute: 'drawer-open' })
  accessor drawerOpen = false

  @property({ type: String }) accessor currentRoute = 'wallet'
  @property({ type: Boolean }) accessor notificationsOpen = false
  @property({ type: Number }) accessor unreadNotifications = 0
  @property({ type: Boolean }) accessor exportOpen = false
  @property({ type: Boolean }) accessor passwordPromptOpen = false
  @property({ type: Boolean }) accessor syncInfoOpen = false
  #media: MediaQueryList

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
    if (name === 'wallet') this.#applyViewData('manager')
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
      this.isNodeReady = globalThis.chain?.state?.sync === 'synced'
      resolve(true)
    })
  })

  get notificationController() {
    return this.shadowRoot.querySelector('notification-controller') as NotificationController
  }
  get #pages() {
    return this.shadowRoot?.querySelector<CustomPages>('custom-pages') ?? null
  }

  select(selected: string) {
    console.log({ selected })

    return this.#select(selected)
  }

  @query('custom-pages')
  accessor pages: CustomPages

  viewWithOrWithoutHistory(view: string): HTMLElement {
    let page = this.#viewHistory.get(view)
    if (!page) {
      if (!navigation.some((item) => item.route === view)) throw new Error(`Unknown application view: ${view}`)
      page = document.createElement(`${view}-view`)
      page.dataset.route = view
      if (view === 'editor') page.append(document.createElement('slot'))
      this.#viewHistory.set(view, page)
    }
    return page
  }

  screenWithOrWithoutHistory(screen: 'login-screen' | 'export-screen' | 'sync-info'): HTMLElement {
    let element = this.#screenHistory.get(screen)
    if (!element) {
      element = document.createElement(screen)
      if (screen === 'export-screen') element.addEventListener('export-close', this.#closeExport)
      if (screen === 'sync-info') element.addEventListener('sync-info-close', this.#closeSyncInfo)
      this.#screenHistory.set(screen, element)
    }
    return element
  }

  #closeExport = () => {
    this.exportOpen = false
  }

  #closeSyncInfo = () => {
    this.syncInfoOpen = false
  }

  #toggleSyncInfo() {
    this.syncInfoOpen = !this.syncInfoOpen
    const syncInfo = this.#screenHistory.get('sync-info') as SyncInfoElement | undefined
    if (syncInfo) syncInfo.open = this.syncInfoOpen
    else if (this.syncInfoOpen) {
      const screen = this.screenWithOrWithoutHistory('sync-info') as SyncInfoElement
      screen.open = true
    }
  }

  async requestWalletPassword(): Promise<string> {
    this.passwordPromptOpen = true
    try {
      await this.rendered
      const login = this.#screenHistory.get('login-screen') as LoginScreenElement | undefined
      if (!login) throw new Error('wallet password screen did not render')
      return await login.requestPassword()
    } finally {
      this.passwordPromptOpen = false
      await this.rendered
    }
  }

  showExport(qrcode: string, exported: string) {
    const screen = this.screenWithOrWithoutHistory('export-screen') as ExportScreenElement
    screen.show(qrcode, exported)
    this.exportOpen = true
  }

  #applyViewData(view: string) {
    const page = this.#viewHistory.get(view)
    if (!page || this.currentRoute !== view) return
    if (view === 'manager') page.wallet = this.wallet
    if (view === 'chat') page.isDesktop = this.isDesktop
  }

  async #select(selected: string) {
    if (!customElements.get(`${selected}-view`)) await import(`./${selected}.js`)
    let pages = this.#pages
    for (let attempt = 0; !pages && attempt < 10; attempt += 1) {
      await new Promise(requestAnimationFrame)
      pages = this.#pages
    }
    if (!pages) throw new Error('application navigation did not render')
    this.currentRoute = selected
    await this.rendered
    pages.select(selected)
    this.#applyViewData(selected)
    if (this.drawerOpen) await this.#setDrawer(false)
    const login = this.shadowRoot?.querySelector<LoginScreenElement>('login-screen')
    if (login && !this.wallet) {
      const needsWallet = selected === 'wallet' || selected === 'identity'
      if (needsWallet && !this.#loginRequested) {
        this.#loginRequested = true
        this.#login().catch((error) => {
          this.#loginRequested = false
          this.nodeStartError = error instanceof Error ? error.message : String(error)
        })
      }
      login.shown = needsWallet
    }
    const monacoContainer = document.querySelector('.container')
    if (monacoContainer) {
      if (selected === 'editor') monacoContainer.classList.add('custom-selected')
      else monacoContainer.classList.remove('custom-selected')
    }
  }

  @query('notification-controller')
  accessor notifications: NotificationController

  @property({ type: Boolean, reflect: true, attribute: 'is-desktop' })
  accessor isDesktop: boolean = false

  #matchMedia = ({ matches }) => {
    this.isDesktop = matches
    this.#applyViewData('chat')
    if (matches && this.drawerOpen) this.#setDrawer(false, false)
    document.dispatchEvent(new CustomEvent('is-desktop', { detail: matches }))
    return matches
  }

  async #setDrawer(open: boolean, restoreFocus = true) {
    this.drawerOpen = open
    await this.requestRender()
    if (open) {
      const selected = this.shadowRoot.querySelector<HTMLElement>('a[aria-current="page"]')
      selected?.focus()
    } else if (restoreFocus) {
      this.shadowRoot.querySelector<HTMLElement>('.menu-toggle')?.focus()
    }
  }

  #drawerKeydown = (event: KeyboardEvent) => {
    if (this.isDesktop || !this.drawerOpen) return
    if (event.key === 'Escape') {
      event.preventDefault()
      this.#setDrawer(false)
    }
    if (event.key !== 'Tab') return
    const items = Array.from(
      this.shadowRoot.querySelectorAll<HTMLElement>('.custom-selector-overlay a, .custom-selector-overlay button')
    )
    const first = items[0]
    const last = items.at(-1)
    if (event.shiftKey && this.shadowRoot.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && this.shadowRoot.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  async connectedCallback() {
    super.connectedCallback()
    this.router = new Router(this, 'wallet')
    this.#media = window.matchMedia('(min-width: 960px)')
    this.#matchMedia(this.#media)
    this.#media.addEventListener('change', this.#matchMedia)

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
    this.#networkTimer = setInterval(() => {
      const connected = Object.values(globalThis.peernet?.connections || {}).some((peer: any) => peer.connected)
      this.isNodeReady = Boolean(connected && globalThis.chain?.state?.sync === 'synced')
    }, 3000)
    import('./integrations/nfc.js')
    // await this.init()
    // globalThis.walletStorage = new Storage('wallet')
    // await globalThis.walletStorage.init()
    // lo
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    clearInterval(this.#networkTimer)
    this.#media?.removeEventListener('change', this.#matchMedia)
  }

  async #login() {
    if (!globalThis.walletStore) {
      // todo: race condition introduced?
      // for some reason walletStore can't find current wallet
      globalThis.walletStore = globalThis.walletStore || (await new Storage('wallet', '.leofcoin/peach'))
      await walletStore.init()
    }

    console.log('wallet')
    console.log(walletStore)

    const hasWallet = Boolean(await walletStore.has('identity'))
    console.log(hasWallet)

    const login = this.shadowRoot?.querySelector<LoginScreenElement>('login-screen')
    if (!login) throw new Error('wallet login screen did not render')
    const pending = login.requestLogin(hasWallet)
    // Navigation may have changed while the wallet store was opening.
    const route = Router.debang(location.hash).split('/')[0]
    login.shown = route === 'wallet' || route === 'identity'
    await pending
  }

  static styles = [
    css`
      :host {
        --lfc-font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif;
        --lfc-navigation-width: 232px;
        --lfc-glass-surface: color-mix(in srgb, var(--md-sys-color-surface-container, #242126) 90%, transparent);
        --lfc-glass-border: color-mix(in srgb, var(--md-sys-color-outline-variant, #625c65) 60%, transparent);
        --lfc-page-width: 720px;
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
        color: var(--md-sys-color-on-surface, #eee);
        overflow: hidden;
      }

      .container {
        position: absolute;
        inset: 0px;
      }

      .main {
        position: relative;
        flex: 1;
        align-self: stretch;
        height: 100%;
        min-width: 0;
        min-height: 0;
        background:
          radial-gradient(
            ellipse at 82% 0%,
            color-mix(in srgb, var(--md-sys-color-primary, #f4a77f) 8%, transparent),
            transparent 42%
          ),
          var(--md-sys-background);
      }

      .main > custom-pages {
        flex: 1;
        min-width: 0;
        min-height: 0;
      }

      .primary-nav {
        min-height: 0;
        flex: 1;
        padding: 8px 0;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overscroll-behavior: contain;
      }

      .custom-selector-overlay {
        height: 100%;
        width: var(--lfc-navigation-width);
        --svg-icon-color: var(--md-sys-color-on-surface-variant);
        border-right: 1px solid var(--lfc-glass-border);
        background: var(--lfc-glass-surface);
        -webkit-backdrop-filter: blur(24px) saturate(1.35);
        backdrop-filter: blur(24px) saturate(1.35);
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

      .brand > span:last-of-type {
        flex: 1;
      }
      .brand small {
        display: block;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--md-sys-color-on-surface-variant);
      }
      .nav-section {
        margin: 16px 24px 8px;
        color: var(--md-sys-color-on-surface-variant);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .icon-button.drawer-close,
      .icon-button.menu-toggle,
      .drawer-backdrop {
        display: none;
      }
      button {
        font: inherit;
        color: inherit;
        cursor: pointer;
      }
      .icon-button {
        display: grid;
        place-items: center;
        flex: 0 0 44px;
        width: 44px;
        height: 44px;
        border: 1px solid var(--lfc-glass-border);
        border-radius: 14px;
        background: transparent;
        position: relative;
      }
      .icon-button:hover {
        background: var(--md-sys-color-surface-container-high);
      }
      button:active {
        transform: translateY(1px);
      }
      a:focus-visible,
      button:focus-visible {
        outline: 2px solid var(--md-sys-color-primary, #f4a77f);
        outline-offset: 3px;
      }
      .notification-dot {
        position: absolute;
        top: 7px;
        right: 7px;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--md-sys-color-primary, #f4a77f);
      }
      .skip-link {
        position: fixed;
        top: -100px;
        left: 16px;
        z-index: 1200;
        background: var(--md-sys-color-surface-container-high);
      }
      .skip-link:focus {
        top: 12px;
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
        border: 1px solid transparent;
        color: var(--md-sys-color-on-surface-variant);
        text-decoration: none;
        font-weight: 600;
        transition:
          background 160ms ease,
          border-color 160ms ease,
          color 160ms ease;
      }

      a:hover {
        background: color-mix(in srgb, var(--md-sys-color-surface-container-high, #302d31) 72%, transparent);
        border-color: color-mix(in srgb, var(--md-sys-color-outline-variant, #625c65) 42%, transparent);
      }

      a[aria-current='page'] {
        background: color-mix(in srgb, var(--md-sys-color-primary-container, #684536) 78%, transparent);
        border-color: color-mix(in srgb, var(--md-sys-color-primary, #f4a77f) 24%, transparent);
        color: var(--md-sys-color-on-primary-container);
        --svg-icon-color: var(--md-sys-color-on-primary-container);
        box-shadow:
          inset 0 1px rgb(255 255 255 / 8%),
          0 4px 16px rgb(0 0 0 / 10%);
      }

      .nav-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .extra-nav-rail {
        align-items: stretch;
        box-sizing: border-box;
        padding: 16px;
        gap: 8px;
        border-top: 1px solid var(--lfc-glass-border);
        font-size: 12px;
        color: var(--md-sys-color-on-surface-variant);
      }
      .extra-nav-rail strong {
        color: var(--md-sys-color-on-surface);
      }
      .extra-nav-rail p {
        margin: 0;
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
        cursor: pointer;
        min-height: 44px;
        font: inherit;
        font-size: 12px;
        -webkit-backdrop-filter: blur(14px) saturate(1.25);
        backdrop-filter: blur(14px) saturate(1.25);
      }

      .sync-status-pill[data-state='syncing'] {
        border-color: var(--md-sys-color-primary);
      }

      .sync-status-pill[data-state='ready'] {
        border-color: var(--md-sys-color-secondary);
      }

      header {
        flex: 0 0 auto;
        min-height: 72px;
        display: flex;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        padding: 10px 24px;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
        background: color-mix(in srgb, var(--md-sys-color-surface, #1c1b1f) 84%, transparent);
        -webkit-backdrop-filter: blur(20px) saturate(1.25);
        backdrop-filter: blur(20px) saturate(1.25);
        gap: 12px;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
      }
      account-select {
        max-width: 250px;
      }

      .page-heading {
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
      }

      .page-title {
        color: var(--md-sys-color-on-surface);
        font-size: 18px;
        line-height: 24px;
        font-weight: 700;
        white-space: nowrap;
      }

      .page-subtitle {
        color: var(--md-sys-color-on-surface-variant);
        font-size: 12px;
        line-height: 18px;
      }

      @media (max-width: 959px) {
        .custom-selector-overlay {
          position: fixed;
          width: min(320px, calc(100vw - 48px));
          height: 100%;
          height: 100dvh;
          padding-bottom: env(safe-area-inset-bottom);
          transform: translateX(-100%);
          visibility: hidden;
          transition:
            transform 200ms ease,
            visibility 200ms;
          z-index: 1150;
          box-shadow: 16px 0 60px rgb(0 0 0 / 20%);
        }
        :host([drawer-open]) .custom-selector-overlay {
          transform: translateX(0);
          visibility: visible;
        }
        .icon-button.drawer-close,
        .icon-button.menu-toggle {
          display: grid;
        }
        :host([drawer-open]) .drawer-backdrop {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 1140;
          border: 0;
          background: rgb(8 7 10 / 52%);
          cursor: default;
        }
        header {
          padding: 10px 16px;
        }
      }

      @media (max-width: 639px) {
        header {
          min-height: 64px;
          padding: 8px 12px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .page-heading {
          flex: 1;
        }
        .page-title {
          font-size: 16px;
        }
        .page-subtitle {
          font-size: 11px;
        }
        .header-actions {
          flex: 1 0 100%;
          gap: 8px;
        }
        .sync-status-pill {
          margin-right: auto;
          padding: 6px 8px;
        }
        account-select {
          min-width: 0;
          width: auto;
          flex: 0 1 210px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          transition: none !important;
          animation: none !important;
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
          <span name="error">@symbol-error</span>
          <span name="warning">@symbol-warning</span>
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
      <a
        class="skip-link"
        href="#main-content"
        @click=${(event: Event) => {
          event.preventDefault()
          this.shadowRoot.querySelector<HTMLElement>('#main-content')?.focus()
        }}
        >Skip to content</a
      >
      <flex-row class="container">
        <button
          class="drawer-backdrop"
          tabindex="-1"
          aria-label="Close navigation"
          @click=${() => this.#setDrawer(false)}></button>
        <aside
          id="app-navigation"
          class="custom-selector-overlay"
          role=${this.isDesktop ? 'complementary' : 'dialog'}
          aria-label="Main navigation"
          aria-modal=${this.isDesktop ? 'false' : 'true'}
          ?inert=${!this.isDesktop && !this.drawerOpen}
          @keydown=${this.#drawerKeydown}>
          <div class="brand">
            <span class="brand-mark" aria-hidden="true">L</span>
            <span>Leofcoin<small>Browser node</small></span>
            <button
              class="icon-button drawer-close"
              aria-label="Close navigation"
              @click=${() => this.#setDrawer(false)}>
              <custom-icon icon="close" aria-hidden="true"></custom-icon>
            </button>
          </div>
          <nav class="primary-nav" aria-label="Workspace">
            <span class="nav-section">Workspace</span>
            ${navigation.map(
              ({ route, label, icon }, index) => html`
                ${index === 5 ? html`<span class="nav-section">Tools & community</span>` : ''}
                <a
                  href=${`#!/${route}`}
                  data-route=${route}
                  aria-current=${this.currentRoute === route ? 'page' : 'false'}
                  @click=${() => {
                    if (!this.isDesktop) this.#setDrawer(false)
                  }}>
                  <custom-icon icon=${icon} aria-hidden="true"></custom-icon>
                  <span class="nav-label">${label}</span>
                </a>
              `
            )}
          </nav>

          <flex-column class="extra-nav-rail">
            <strong>Peach test network</strong>
            <p>Test tokens only · No monetary value</p>
          </flex-column>
        </aside>

        <flex-column class="main" ?inert=${!this.isDesktop && this.drawerOpen}>
          <header>
            <button
              class="icon-button menu-toggle"
              aria-label="Open navigation"
              aria-controls="app-navigation"
              aria-expanded=${String(this.drawerOpen)}
              @click=${() => this.#setDrawer(true)}>
              <custom-icon icon="menu_open" aria-hidden="true"></custom-icon>
            </button>
            <span class="page-heading">
              <span class="page-title"
                >${navigation.find((item) => item.route === this.currentRoute)?.label || 'Node console'}</span
              >
              <span class="page-subtitle">Your browser. Your node.</span>
            </span>
            <button
              class="icon-button notification-toggle"
              aria-label=${`Notifications${this.unreadNotifications ? `, ${this.unreadNotifications} unread` : ''}`}
              aria-haspopup="dialog"
              aria-expanded=${String(this.notificationsOpen)}
              @click=${() => {
                this.notifications.open = !this.notifications.open
              }}>
              <custom-icon icon="notifications" aria-hidden="true"></custom-icon>
              ${this.unreadNotifications ? html`<span class="notification-dot" aria-hidden="true"></span>` : ''}
            </button>
            <div class="header-actions">
              <button
                class="sync-status-pill"
                title="View node sync details"
                aria-label=${`${this.syncLabel}. View sync details`}
                @click=${() => this.#toggleSyncInfo()}
                data-state=${this.nodeStartError ? 'error' : this.isNodeReady ? 'ready' : 'syncing'}>
                <custom-icon
                  aria-hidden="true"
                  icon=${this.nodeStartError ? 'error' : this.isNodeReady ? 'check_box' : 'sync'}></custom-icon>
                ${this.syncLabel}
              </button>
              ${this.wallet ? html`<account-select></account-select>` : ''}
            </div>
          </header>
          <custom-pages
            id="main-content"
            role="main"
            tabindex="-1"
            aria-label=${navigation.find((item) => item.route === this.currentRoute)?.label || 'Node console'}
            attr-for-selected="data-route">
                ${this.viewWithOrWithoutHistory(this.currentRoute)}
              </custom-pages>
        </flex-column>
      </flex-row>

      ${(!this.wallet && (this.currentRoute === 'wallet' || this.currentRoute === 'identity')) ||
      this.passwordPromptOpen ||
      this.#screenHistory.get('login-screen')?.hasAttribute('shown')
        ? this.screenWithOrWithoutHistory('login-screen')
        : ''}
      ${this.exportOpen ? this.screenWithOrWithoutHistory('export-screen') : ''}
      ${this.syncInfoOpen ? this.screenWithOrWithoutHistory('sync-info') : ''}

      <notification-controller
        @notifications-change=${(event: CustomEvent) => {
          this.notificationsOpen = event.detail.open
          this.unreadNotifications = event.detail.unread
        }}></notification-controller>
    `
  }
}
export default AppShell
