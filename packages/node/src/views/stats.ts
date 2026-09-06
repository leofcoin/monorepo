import { LitElement, PropertyValueMap, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import '../elements/shorten-string.js'
import { map } from 'lit/directives/map.js'
import type P2PTPeer from '@netpeer/p2pt-swarm/peer'

@customElement('stats-view')
export class StatsView extends LitElement {
  @property({ type: Array })
  accessor peers: [string, P2PTPeer][] = []

  @property({ type: String })
  accessor peerId: base58String

  #peerChange = async (peer) => {
    this.peers = await client.peers()
  }

  async connectedCallback() {
    super.connectedCallback()
    // this.shadowRoot.querySelector('.peerId').value = await client.peerId()
    this.peers = await client.peers()
    this.peerId = await client.peerId()
    pubsub.subscribe('peer:connected', this.#peerChange)
    pubsub.subscribe('peer:left', this.#peerChange)
  }

  static get styles() {
    return [
      css`
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          color: var(--font-color);
        }

        flex-row {
          width: 100%;
          align-items: center;
        }

        flex-column {
          max-width: 640px;
          max-height: 480px;
          width: 100%;
          height: 100%;
        }

        .peers-container {
          padding-top: 24px;
        }

        .version {
          padding: 12px 0;
        }

        .container {
          max-width: 320px;
          width: 100%;
          background: var(--secondary-background);
          border: 1px solid var(--border-color);
          padding: 12px 24px;
          box-sizing: border-box;
          border-radius: 24px;
        }
      `
    ]
  }

  render() {
    return html`
      <hero-element>
        <flex-row class="id">
          <strong>id</strong>
          <flex-it></flex-it>
          ${this.peerId ? html`<shorten-string .value=${this.peerId}></shorten-string>` : 'loading'}
        </flex-row>
        <flex-row class="version">
          <strong>version</strong>
          <flex-it></flex-it>
          <span class="version">@version</span>
        </flex-row>
        <flex-row class="version">
          <strong>build</strong>
          <flex-it></flex-it>
          <span class="version">@build</span>
        </flex-row>
        <flex-row>
          <strong>peers</strong>
          <flex-it></flex-it>
          <span>${this.peers.length}</span>
        </flex-row>

        <flex-column class="peers-container">
          ${this.peers ? map(this.peers, ([id, peer]) => html` <shorten-string .value=${id}></shorten-string> `) : ''}
        </flex-column>
      </hero-element>
    `
  }
}
