export default customElements.define('connect-view', class ConnectView extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = `
      <style>
        * {
          pointer-events: none;
        }
        :host {
          display: flex;
          background: rgba(0,0,0, 0.87);
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
        }

        .dialog {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 320px;
          max-height: 480px;
          height: 100%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 12px 24px;
          color: var(--main-color);
          background: var(--main-background-color);
          box-shadow: 0 1px 18px 0px var(--accent-color);
          border-radius: 24px;
        }

        /* :host([shown]) {
          opacity: 1 !important;
          pointer-events: auto !important;
          z-index: 10000;
        }

        :host([shown]) .content::slotted(*) {
          pointer-events: auto !important;
        } */

        .heading {
          padding-bottom: 6px;
          width: 100%;
        }

        [name="title"]::slotted(*) {
          text-transform: uppercase;
        }
        button {
          pointer-events: auto;
          cursor: pointer;
          border-radius: 12px;
          display: flex;
          max-width: 180px;
          font-size: 18px;
          align-items: center;
          text-transform: capitalize;
        }

      </style>
      <span class="dialog">
        <flex-row class="heading">
          <strong>Connect Wallet</strong>
          <flex-one></flex-one>
          <custom-svg-icon icon="clear" data-close></custom-svg-icon>
        </flex-row>
        <flex-one></flex-one>
          <button data-route="metamask" data-confirm="metamask" data-input="metamask" data-value="metamask">
            <img src="https://assets.artonline.site/metamask-fox.svg"></img>
            <flex-one></flex-one>
            <strong>metamask</strong>
          </button>
        <flex-one></flex-one>
      </span>
    `
    this.setAttribute('data-close', '')
  }

  async connect() {
    this.setAttribute('shown', '')

    return new Promise(async (resolve, reject) => {
      const _onclick = async event => {
        console.log(event);
        const target = event.composedPath()[0]
        if (target.hasAttribute('data-close')) {
          resolve({ action: 'close' })
          this.removeAttribute('shown')
          this.removeEventListener('click', _onclick)
          return
        }

        if (target.hasAttribute('data-confirm')) {
          const inputs = this.shadowRoot.querySelectorAll('[data-input]')
          const value = {}
          for (const input of inputs) {
            value[input.getAttribute('data-input')] = input.value || input.getAttribute('data-value')
          }
          localStorage.setItem('wallet', JSON.stringify({
            type: 'metamask'
          }))
          await isApiReady()
          await api.connectWallet()
          resolve({
            action: 'confirm',
            value
          })
          this.removeAttribute('shown')
          this.removeEventListener('click', _onclick)
        }
      }
      this.addEventListener('click', _onclick)
    })
  }
})
