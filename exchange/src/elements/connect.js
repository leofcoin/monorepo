export default customElements.define('connect-element', class ConnectElement extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          background: rgba(0,0,0, 0.87);
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0;
          pointer-events: none;
          z-index: 0;
        }

        .dialog {
          display: flex;
          flex-direction: column;
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

        :host([shown]) {
          opacity: 1 !important;
          pointer-events: auto !important;
          z-index: 10000;
        }

        .heading {
          padding-bottom: 6px;
        }

        [name="title"]::slotted(*) {
          text-transform: uppercase;
        }
      </style>
      <span class="dialog">
        <flex-row class="heading">
          <slot name="title"></slot>
          <flex-one></flex-one>
          <custom-svg-icon icon="clear" data-close></custom-svg-icon>
        </flex-row>
        <flex-one></flex-one>
        <slot></slot>
        <flex-one></flex-one>
      </span>
    `
    this.setAttribute('data-close', '')
  }

  async show() {
    this.setAttribute('shown', '')

    return new Promise((resolve, reject) => {
      const _onclick = event => {
        console.log(event);
        const target = event.composedPath()[0]
        if (target.hasAttribute('data-close')) {
          resolve({ action: 'close' })
          this.removeAttribute('shown')
          this.removeEventListener('click', _onclick)
          return
        }

        if (target.hasAttribute('data-confirm')) {
          const inputs = this.querySelectorAll('[data-input]')
          const value = {}
          for (const input of inputs) {
            value[input.getAttribute('data-input')] = input.value
          }
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
