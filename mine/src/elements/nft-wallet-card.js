import {rotate, basicRotation} from '../styles/shared'

export default customElements.define('nft-wallet-card', class NFTWalletCard extends HTMLElement {
  static get observedAttributes() {
    return ['token-id', 'mining', 'status', 'token']
  }
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  attributeChangedCallback(name, old, value) {
    if (this[name] !== value) {
      if (name === 'token-id') name = 'tokenId'
      this[name] = name === 'mining' ? Boolean(value === 'true') : value

    }
  }

  set tokenId(value) {
    this.shadowRoot.querySelector('strong').innerHTML = value
    this.shadowRoot.querySelector('custom-svg-icon[icon="arrow-drop-down"]').setAttribute('title', `Transfer token ${value}`)
    this.shadowRoot.querySelector('custom-svg-icon[icon="arrow-drop-down"]').setAttribute('token-id', value)
    this._tokenId = value
  }

  get template() {
    return `
    <style>
      * {
        pointer-events: none;
        user-select: none;
      }

      :host {
        color: var(--primary-text-color);
        display: flex;
        align-items: center;
        width: 100%;
        padding: 12px 24px;
        box-sizing: border-box;
      }

      ${rotate}

      :host([mining="true"]) custom-svg-icon[icon="fan"] {
        ${basicRotation}
      }

      :host([booting][mining="true"]) custom-svg-icon[icon="fan"] {
        -webkit-animation: rotation 500ms linear infinite;
        -moz-animation: rotation 500ms linear infinite;
        -ms-animation: rotation 500ms linear infinite;
        -o-animation: rotation 500ms linear infinite;
        animation: rotation 500ms linear infinite;
      }

      :host([slowing-down][mining="true"]) custom-svg-icon[icon="fan"] {
        -webkit-animation: rotation 4s linear infinite;
        -moz-animation: rotation 4s linear infinite;
        -ms-animation: rotation 4s linear infinite;
        -o-animation: rotation 4s linear infinite;
        animation: rotation 4s linear infinite;
      }

      :host([stopping][mining="true"]) custom-svg-icon[icon="fan"] {
        -webkit-animation: rotation 8s linear infinite;
        -moz-animation: rotation 8s linear infinite;
        -ms-animation: rotation 8s linear infinite;
        -o-animation: rotation 8s linear infinite;
        animation: rotation 8s linear infinite;
      }

      :host([stopped][mining="true"]) custom-svg-icon[icon="fan"] {
        -webkit-animation: rotation 16s linear 120ms;
        -moz-animation: rotation 16s linear 120ms;
        -ms-animation: rotation 16s linear 120ms;
        -o-animation: rotation 16s linear 120ms;
        animation: rotation 16s linear 120ms;
      }

      strong {
        padding-left: 6px;
        padding-right: 6px;
      }

      custom-svg-icon[icon="arrow-drop-down"], custom-svg-icon[icon="arrow-drop-up"] {
        cursor: pointer;
        pointer-events: auto;
      }


    </style>
    <custom-svg-icon icon="fan"></custom-svg-icon>
    <strong></strong>
    <flex-one></flex-one>

    <custom-svg-icon icon="arrow-drop-down" data-action="dropdown"></custom-svg-icon>
    `
  }
})
