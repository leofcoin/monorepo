import { css, html, LitElement } from 'lit'
import './child.js'
import { customElement, property } from 'lit/decorators.js'
import { NotificationChild } from './child.js'
import '@vandeurenglenn/lite-elements/icon.js'
import '@vandeurenglenn/lite-elements/pane.js'
import '@vandeurenglenn/flex-elements/row.js'

@customElement('notification-controller')
export class NotificationController extends LitElement {
  @property({ type: Boolean, reflect: true })
  accessor open: boolean

  get #list() {
    return this.shadowRoot.querySelector('.list')
  }

  createNotification({ title, message }: { title: string; message: string }, timeout: EpochTimeStamp = 3000) {
    const notification = document.createElement('notification-child') as NotificationChild
    notification.title = title
    notification.message = message
    if (timeout) {
      setTimeout(() => {
        this.removeChild(notification)
        const _notification = document.createElement('notification-child') as NotificationChild
        _notification.title = title
        _notification.message = message
        this.#list.appendChild(_notification)
        this.requestUpdate()
      }, timeout)
    }
    this.appendChild(notification)
  }

  #onclick() {
    const children = Array.from(this.#list.querySelectorAll('notification-child'))
    for (const child of children) {
      this.#list.removeChild(child)
    }
    this.open = false
  }

  static styles = css`
    :host {
      display: contents;
    }

    :host([open]) {
      background: rgb(51, 55, 80);
    }

    .recents {
      display: block;
      position: absolute;
      top: 12px;
      right: 12px;
      width: 100%;
      pointer-events: none;

      box-sizing: border-box;
      padding: 12px;
    }

    .list {
      padding: 24px;
      height: 100%;
    }

    custom-icon {
      pointer-events: auto;
    }

    custom-pane {
      bottom: 0;
      position: absolute;
      max-height: 75%;
      left: 50%;
      max-width: 1200px;
      color: #eee;
      border-radius: var(--md-sys-shape-corner-large-top);
      transform: translateX(-50%) translateY(100%);
    }
    custom-pane[open] {
      transform: translateX(-50%) translateY(0);
    }
  `

  render() {
    return html`
      <span class="recents">
        <slot></slot>
      </span>

      <custom-pane ?open=${this.open} left>
        <span slot="header"></span>
        <flex-column class="list" slot="content"> </flex-column>

        <flex-row slot="footer" width="100%">
          <flex-it></flex-it>
          <custom-icon style="margin-right: 24px;" icon="clear-all" @click="${this.#onclick}"></custom-icon>
        </flex-row>
      </custom-pane>
    `
  }
}
