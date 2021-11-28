import {rotate, basicRotation} from '../styles/shared'
import './upgrade-img'

export default customElements.define('nft-pool-card', class NFTPoolCard extends HTMLElement {
  static get observedAttributes() {
    return ['token-id', 'mining', 'status', 'bonus']
  }
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
  }

  attributeChangedCallback(name, old, value) {
    if (this[name] !== value) {
      if (name === 'token-id') name = 'tokenId'
      this[name] = name === 'mining' ? Boolean(value === 'true') : value
      this._observer()
    }
  }

  _observer() {
    if (this.tokenId && this.mining !== undefined && this.status && this.bonus !== undefined) this.shadowRoot.innerHTML = this.template
  }
// hardware:toys
  get template() {
    return `
    <style>
      :host {
        color: var(--primary-text-color);
        display: flex;
        align-items: center;
        width: 100%;
        padding: 12px 24px;
        box-sizing: border-box;
      }

      ${rotate}

      :host([mining="true"]) custom-svg-icon[icon="fan"], :host([mining="true"]) upgrade-img {
        ${basicRotation}
      }

      :host([booting][mining="true"]) custom-svg-icon[icon="fan"], :host([booting][mining="true"]) upgrade-img {
        -webkit-animation: rotation 500ms linear infinite;
        -moz-animation: rotation 500ms linear infinite;
        -ms-animation: rotation 500ms linear infinite;
        -o-animation: rotation 500ms linear infinite;
        animation: rotation 500ms linear infinite;
      }

      :host([slowing-down][mining="true"]) custom-svg-icon[icon="fan"], :host([slowing-down][mining="true"]) upgrade-img {
        -webkit-animation: rotation 4s linear infinite;
        -moz-animation: rotation 4s linear infinite;
        -ms-animation: rotation 4s linear infinite;
        -o-animation: rotation 4s linear infinite;
        animation: rotation 4s linear infinite;
      }

      :host([stopping][mining="true"]) custom-svg-icon[icon="fan"], :host([stopping][mining="true"]) upgrade-img {
        -webkit-animation: rotation 8s linear infinite;
        -moz-animation: rotation 8s linear infinite;
        -ms-animation: rotation 8s linear infinite;
        -o-animation: rotation 8s linear infinite;
        animation: rotation 8s linear infinite;
      }

      :host([stopped][mining="true"]) custom-svg-icon[icon="fan"], :host([stopped][mining="true"]) upgrade-img {
        -webkit-animation: rotation 16s linear 120ms;
        -moz-animation: rotation 16s linear 120ms;
        -ms-animation: rotation 16s linear 120ms;
        -o-animation: rotation 16s linear 120ms;
        animation: rotation 16s linear 120ms;
      }

      strong {
        padding-right: 6px;
      }

      .status {
        padding-left: 6px;
      }

      custom-svg-icon[icon="stop"], custom-svg-icon[icon="play"] {
        cursor: pointer;
        pointer-events: auto;
      }

      .spacer {
        width: 6px;
        display: block;
      }
    </style>
    <strong>${this.tokenId}</strong>
    <custom-svg-icon icon="fan"></custom-svg-icon>
    <span class="spacer"></span>
    ${this.bonus === "true" ? '<upgrade-img symbol="SPINNER"></upgrade-img>' : ''}
    <span class="status">${this.status}</span>
    <flex-one></flex-one>
    <custom-svg-icon data-id="${this.tokenId}" data-action="${this.mining === true ? 'deactivate' : 'activate'}" icon=${this.mining === true ? 'stop' : 'play'}></custom-svg-icon>

    `
  }
})
