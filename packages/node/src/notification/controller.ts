import { css, html, LitElement } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import './child.js'
import { consoleDrawerStyles, isBackdropClick } from '../elements/console-drawer-styles.js'

type Notice = {
  id: number
  title: string
  message: string
  type?: 'error' | 'info' | 'warning'
  recent: boolean
  unread: boolean
  createdAt: number
}

@customElement('notification-controller')
export class NotificationController extends LitElement {
  @property({ type: Boolean, reflect: true }) accessor open = false
  @state() accessor entries: Notice[] = []
  @state() accessor filter: 'all' | 'error' = 'all'
  get unread() { return this.entries.filter(entry => entry.unread).length }
  #nextId = 0
  #timers = new Map<number, { timer?: ReturnType<typeof setTimeout>; remaining: number; started: number }>()

  createNotification(
    { title, message, type }: { title: string; message: string; type?: Notice['type'] },
    timeout: EpochTimeStamp = 3000
  ) {
    const entry = { id: ++this.#nextId, title, message, type, recent: !this.open, unread: !this.open, createdAt: Date.now() }
    const retained = [entry, ...this.entries].slice(0, 100)
    const ids = new Set(retained.map(entry => entry.id))
    for (const [id, record] of this.#timers) {
      if (!ids.has(id)) { clearTimeout(record.timer); this.#timers.delete(id) }
    }
    this.entries = retained
    if (timeout > 0 && !this.open) {
      this.#timers.set(entry.id, { remaining: timeout, started: 0 })
      this.#resume(entry.id)
    }
    this.#announce()
  }

  #announce() {
    this.dispatchEvent(new CustomEvent('notifications-change', {
      detail: { open: this.open, count: this.entries.length, unread: this.unread },
      bubbles: true, composed: true
    }))
  }

  #pause(id: number) {
    const timer = this.#timers.get(id)
    if (!timer?.timer) return
    clearTimeout(timer.timer)
    timer.timer = undefined
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.started))
  }

  #resume(id: number) {
    const timer = this.#timers.get(id)
    if (!timer || timer.timer) return
    timer.started = Date.now()
    timer.timer = setTimeout(() => {
      this.entries = this.entries.map(entry => entry.id === id ? { ...entry, recent: false } : entry)
      this.#timers.delete(id)
    }, timer.remaining)
  }

  #dismiss(id: number) {
    clearTimeout(this.#timers.get(id)?.timer)
    this.#timers.delete(id)
    this.entries = this.entries.filter(entry => entry.id !== id)
    this.#announce()
  }

  #clear = () => {
    for (const { timer } of this.#timers.values()) clearTimeout(timer)
    this.#timers.clear()
    this.entries = []
    this.#announce()
  }

  updated(changed: Map<string, unknown>) {
    if (!changed.has('open')) return
    const dialog = this.shadowRoot.querySelector('dialog')
    if (this.open && !dialog.open) {
      for (const { timer } of this.#timers.values()) clearTimeout(timer)
      this.#timers.clear()
      this.entries = this.entries.map(entry => ({ ...entry, recent: false, unread: false }))
      dialog.showModal()
    } else if (!this.open && dialog.open) dialog.close()
    this.#announce()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    for (const { timer } of this.#timers.values()) clearTimeout(timer)
    this.#timers.clear()
    this.entries = this.entries.map(entry => ({ ...entry, recent: false }))
  }

  #card(entry: Notice) {
    return html`<notification-child
      .title=${entry.title} .message=${entry.message} .type=${entry.type || 'info'} .createdAt=${entry.createdAt}
      @notification-dismiss=${() => this.#dismiss(entry.id)}
      @notification-pause=${() => this.#pause(entry.id)}
      @notification-resume=${() => this.#resume(entry.id)}>
    </notification-child>`
  }

  static styles = [consoleDrawerStyles, css`
    .recents {
      position: fixed; top: 88px; right: 24px; z-index: 1100;
      width: min(380px, calc(100vw - 32px)); max-height: calc(100dvh - 112px);
      overflow: auto; display: grid; gap: 10px; pointer-events: none;
    }
    .recents notification-child { pointer-events: auto; }
    .tabs { display: flex; gap: 8px; padding: 16px 24px 0; }
    .tabs button { flex: 1; }
    .tabs button[aria-pressed='true'] { background: var(--md-sys-color-secondary-container, #393d4a); border-color: transparent; color: var(--md-sys-color-on-secondary-container, #e2e2ef); }
    .list { overflow: auto; overscroll-behavior: contain; flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .empty { margin: auto; padding: 32px 16px; text-align: center; }
    .empty custom-icon { --custom-icon-size: 32px; margin-bottom: 16px; }
    .empty strong { display: block; font-size: 18px; }
    footer button { width: 100%; }
    footer p { font-size: 11px; text-align: center; margin-top: 10px; }
    .more { pointer-events: auto; background: var(--md-sys-color-surface-container, #242126); }
    @media (max-width: 639px) {
      .recents { top: 132px; right: 16px; max-height: calc(100dvh - 156px); }
    }
  `]

  render() {
    const recent = this.open ? [] : this.entries.filter(entry => entry.recent)
    const visible = this.entries.filter(entry => this.filter === 'all' || entry.type === 'error')
    return html`
      <div class="recents" role="region" aria-label="Recent notifications" aria-live="polite" aria-relevant="additions">
        ${repeat(recent.slice(0, 3), entry => entry.id, entry => this.#card(entry))}
        ${recent.length > 3 ? html`<button class="more" @click=${() => { this.open = true }}>View ${recent.length - 3} more notifications</button>` : ''}
      </div>
      <dialog aria-labelledby="notifications-title"
        @cancel=${() => { this.open = false }}
        @close=${() => { this.open = false }}
        @click=${(event: MouseEvent) => {
          if (isBackdropClick(event)) this.open = false
        }}>
        <header>
          <div><span class="eyebrow">Activity inbox</span><h2 id="notifications-title">Notifications</h2><p>${this.entries.length} saved in this session</p></div>
          <button class="close" aria-label="Close notifications" @click=${() => { this.open = false }}><custom-icon icon="close" aria-hidden="true"></custom-icon></button>
        </header>
        <div class="tabs" role="group" aria-label="Filter notifications">
          <button aria-pressed=${String(this.filter === 'all')} @click=${() => { this.filter = 'all' }}>All (${this.entries.length})</button>
          <button aria-pressed=${String(this.filter === 'error')} @click=${() => { this.filter = 'error' }}>Errors (${this.entries.filter(entry => entry.type === 'error').length})</button>
        </div>
        <div class="list">
          ${visible.length
            ? repeat(visible, entry => entry.id, entry => this.#card(entry))
            : html`<div class="empty"><custom-icon icon="notifications" aria-hidden="true"></custom-icon><strong>${this.filter === 'error' ? 'No errors to show' : "You're all caught up"}</strong><p>${this.filter === 'error' ? 'Error notifications will be collected here.' : 'Node and wallet notifications will appear here.'}</p></div>`}
        </div>
        <footer><button ?disabled=${!this.entries.length} @click=${this.#clear}>Clear all notifications</button><p>Last 100 retained in this tab. Closing a toast does not change a transaction.</p></footer>
      </dialog>
    `
  }
}
