import { css, html, LitElement } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import './child.js'

type Notice = {
  id: number
  title: string
  message: string
  type?: 'error' | 'info' | 'warning'
  recent: boolean
  unread: boolean
}

@customElement('notification-controller')
export class NotificationController extends LitElement {
  @property({ type: Boolean, reflect: true }) accessor open = false
  @state() accessor entries: Notice[] = []
  get unread() { return this.entries.filter(entry => entry.unread).length }
  #nextId = 0
  #timers = new Map<number, { timer?: ReturnType<typeof setTimeout>; remaining: number; started: number }>()

  createNotification(
    { title, message, type }: { title: string; message: string; type?: Notice['type'] },
    timeout: EpochTimeStamp = 3000
  ) {
    const entry = { id: ++this.#nextId, title, message, type, recent: !this.open, unread: !this.open }
    this.entries = [entry, ...this.entries]
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
  }

  #card(entry: Notice) {
    return html`<notification-child
      .title=${entry.title} .message=${entry.message} .type=${entry.type || 'info'}
      @notification-dismiss=${() => this.#dismiss(entry.id)}
      @notification-pause=${() => this.#pause(entry.id)}
      @notification-resume=${() => this.#resume(entry.id)}>
    </notification-child>`
  }

  static styles = css`
    :host { display: contents; color: var(--md-sys-color-on-surface, #eee); }
    .recents {
      position: fixed; top: 88px; right: 24px; z-index: 1100;
      width: min(380px, calc(100vw - 32px)); max-height: calc(100dvh - 112px);
      overflow: auto; display: grid; gap: 10px; pointer-events: none;
    }
    .recents notification-child { pointer-events: auto; }
    dialog {
      position: fixed; inset: 12px 12px 12px auto; margin: 0;
      width: min(420px, calc(100vw - 24px)); height: calc(100dvh - 24px);
      max-width: none; max-height: none; padding: 0; box-sizing: border-box;
      color: inherit; background: var(--lfc-glass-surface, #242126);
      border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 24px;
      box-shadow: 0 24px 80px rgb(0 0 0 / 28%);
      backdrop-filter: blur(28px) saturate(1.2); -webkit-backdrop-filter: blur(28px) saturate(1.2);
    }
    dialog[open] { display: flex; flex-direction: column; }
    dialog::backdrop { background: rgb(8 7 10 / 48%); }
    header { display: flex; align-items: center; gap: 12px; padding: 20px; border-bottom: 1px solid var(--lfc-glass-border, #51474e); }
    header div { flex: 1; }
    h2 { font-size: 22px; letter-spacing: -.03em; margin: 0; }
    p { color: var(--md-sys-color-on-surface-variant, #ccc); font-size: 13px; margin: 4px 0 0; }
    .list { overflow: auto; overscroll-behavior: contain; flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .empty { margin: auto; padding: 32px 16px; text-align: center; }
    .empty custom-icon { --custom-icon-size: 32px; margin-bottom: 16px; }
    .empty strong { display: block; font-size: 18px; }
    footer { padding: 12px 20px max(12px, env(safe-area-inset-bottom)); border-top: 1px solid var(--lfc-glass-border, #51474e); }
    button { font: inherit; color: inherit; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 12px; background: transparent; min-height: 44px; padding: 0 16px; cursor: pointer; }
    .close { width: 44px; padding: 0; display: grid; place-items: center; }
    button:hover:not(:disabled) { background: var(--md-sys-color-surface-container-high, #383139); }
    button:focus-visible { outline: 2px solid var(--md-sys-color-primary, #f4a77f); outline-offset: 3px; }
    button:disabled { opacity: .45; cursor: default; }
    @media (max-width: 639px) {
      .recents { top: 132px; right: 16px; max-height: calc(100dvh - 156px); }
      dialog { inset: auto 0 0; width: 100%; height: 85dvh; border-radius: 24px 24px 0 0; }
    }
  `

  render() {
    return html`
      <div class="recents" role="region" aria-label="Recent notifications" aria-live="polite" aria-relevant="additions">
        ${repeat(this.open ? [] : this.entries.filter(entry => entry.recent), entry => entry.id, entry => this.#card(entry))}
      </div>
      <dialog aria-labelledby="notifications-title"
        @cancel=${() => { this.open = false }}
        @close=${() => { this.open = false }}
        @click=${(event: MouseEvent) => {
          if (event.target === event.currentTarget) {
            const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.open = false
          }
        }}>
        <header>
          <div><h2 id="notifications-title">Notifications</h2><p>${this.entries.length} saved in this session</p></div>
          <button class="close" aria-label="Close notifications" @click=${() => { this.open = false }}><custom-icon icon="close" aria-hidden="true"></custom-icon></button>
        </header>
        <div class="list">
          ${this.entries.length
            ? repeat(this.entries, entry => entry.id, entry => this.#card(entry))
            : html`<div class="empty"><custom-icon icon="notifications" aria-hidden="true"></custom-icon><strong>You're all caught up</strong><p>Node and wallet notifications will appear here.</p></div>`}
        </div>
        <footer><button ?disabled=${!this.entries.length} @click=${this.#clear}>Clear all notifications</button></footer>
      </dialog>
    `
  }
}
