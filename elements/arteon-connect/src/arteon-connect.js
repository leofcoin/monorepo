import PubSub from './../../../node_modules/@vandeurenglenn/little-pubsub/src/index'

globalThis.pubsub = new PubSub()

export default customElements.define('arteon-connect', class ArteonConnect extends HTMLElement {
  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
    this._onclick = this._onclick.bind(this)
  }

  connectedCallback() {
    this.addEventListener('click', this._onclick)
  }

  async _onclick(event) {
    const target = event.composedPath()[0]

    if (target.hasAttribute('data-action')) {
      if (target.getAttribute('data-action') === 'connect') this._connect()
      else this._guide()


      pubsub.publish('connect', true)
      this._hide()
    }
  }

  _hide() {
    this.setAttribute('hidden', '')
  }

  _connect() {
    pubsub.publish('connect')
  }

  _guide() {
    pubsub.publish('guide')
  }


  get template() {
    return `
    <style>
      * {
        pointer-events: none;
        user-select: none;
      }
      :host {
        padding-top: 128px;
        z-index: 10000000000;
        display: flex;
        flex-direction: column;
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        background: var(--main-background-color);
        color: var(--main-color);
        --svg-icon-color: #333;
        align-items: center;
      }

      .info {
        width: 320px;
      }

      .logo {
        height: 144px;
      }

      button {
        display: flex;
        background: transparent;
        align-items: center;
        box-sizing: border-box;
        padding: 6px 12px;
        background: var(--main-color);
        min-width: 110px;
        pointer-events: auto;
        height: 44px;
        width: 100%;
        max-width: 140px;
        font-weight: 700;
        font-size: 16px;
        text-transform: uppercase;
        cursor: pointer;
      }

      h1, h2 {
        margin: 0;
        color: var(--main-color);
      }
      h1 {
        padding-top: 36px;
        font-weight: 500;
        font-size: 36px;
      }

      h2 {
        padding-bottom: 48px;
        font-weight: 300;
        font-size: 22px;
      }

      button[data-action="connect"] {
        border-bottom-left-radius: 24px;
        border-top-right-radius: 24px;
      }

      button[data-action="guide"] {
        border-top-left-radius: 24px;
        border-bottom-right-radius: 24px;
      }

      section {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding-bottom: 24px;
      }

      .full-spec {
        max-width: 1440px;
        width: 100%;
      }

      .info span {
        padding-left: 6px;
      }

      .info button {
        justify-content: center;
      }

      :host([hidden]) {
        opacity: 0;
        pointer-events: none;
        transform: translateY(-110%);
        transition: transform 320ms ease-out, opacity 640ms ease-out;
      }
    </style>
    <section>
      <img class="logo" src="./assets/arteon.svg" loading="lazy"></img>
      <h1>Arteon</h1>
      <h2>Mining platform</h2>

      <flex-row class="info">
        <button data-action="connect">
          <img src="./assets/metamask-fox.svg" loading="lazy"></img>
          <span>connect</span>
        </button>
        <flex-one></flex-one>
        <button data-action="guide">
          <custom-svg-icon icon="book"></custom-svg-icon>
          <span>how to</span>
        </button>
      </flex-row>
    </section>
    <img class="full-spec" src="./assets/full_spec.png" loading="lazy"></img>
    `
  }
})
