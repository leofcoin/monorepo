
import './../elements/gpu-select'
import './../elements/gpu-img'
import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-column'
import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-row'
import './../../node_modules/@vandeurenglenn/flex-elements/src/flex-one'
import PLATFORM_ABI from './../../../abis/platform'

export default customElements.define('send-view', class SendView extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this._onGpuSelected = this._onGpuSelected.bind(this);
    this._send = this._send.bind(this);

    (async () => {

      this.shadowRoot.innerHTML = `
        <style>
          * {
            pointer-events: none;
          }
          :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            color: #fff;
          }
          flex-row, button {
            padding: 6px;
            box-sizing: border-box;
          }

          button, input {
            pointer-events: auto;
          }

          .hero {
            border-radius: 24px;
            box-sizing: border-box;
            border: 1px solid #fff;
            max-width: 320px;
            width: 100%;
            padding: 24px;
          }
          [center] {
            align-items: center;
          }
        </style>
        <flex-column class="hero">
          <gpu-img></gpu-img>

          <flex-row>
            <strong>gpu</strong>
            <flex-one></flex-one>
            <gpu-select></gpu-select>
          </flex-row>

        </flex-column>

        <flex-column class="hero">
          <flex-row center>
            <strong>to</strong>
            <flex-one></flex-one>
            <input data-input="to"></input>
          </flex-row>

          <flex-row center>
            <strong>tokenId</strong>
            <flex-one></flex-one>
            <input data-input="tokenId"></input>
          </flex-row>

          <button>send</button>
        </flex-column>
      `
      this._img.symbol = 'GENESIS'

      this._select._select.addEventListener('selected', this._onGpuSelected)
      this.shadowRoot.querySelector('button').addEventListener('click', this._send)
    })()

  }

  get _img() {
    return this.shadowRoot.querySelector('gpu-img')
  }

  get _select() {
    return this.shadowRoot.querySelector('gpu-select')
  }

  get _input() {
    return this.shadowRoot.querySelector('input')
  }

  async _onGpuSelected({detail}) {
    const selected = this._select.shadowRoot.querySelector(`[data-route="${detail}"]`)
    this._img.symbol = detail.toUpperCase()


  }

  async _send() {
    const selected = this._select._select.selected
    console.log(selected);
    const id = api.cards.indexOf(selected)
    console.log(id);

    const to = this.shadowRoot.querySelector('input[data-input="to"]').value
    const tokenId = this.shadowRoot.querySelector('input[data-input="tokenId"]').value

    this.platform = api.getContract(api.addresses.platform, PLATFORM_ABI, api.signer)
    try {
      await this.platform.safeTransferFrom(api.signer.address, to, id, tokenId, 0)
    } catch (e) {
      if (e.data.message.includes('DEACTIVATE_FIRST')) alert('Deactivate the GPU before transfering!')
    }
  }
})
