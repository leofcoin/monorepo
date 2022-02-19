import './asset-player'
export default customElements.define('creations-token-item', class CreationsTokenItem extends BaseClass {
  static get observedAttributes() {
    return ['address', 'symbol', 'token', 'tokenid', 'image', 'onexchange']
  }
  constructor() {
    super()
  }

  attributeChangedCallback(name, old, value) {
    if (value !== old) this[name] = value
  }

  set symbol(value) {
    this.sqs('.symbol').innerHTML = value
  }

  set tokenid(value) {
    this.sqs('.tokenid').innerHTML = `#${value}`
  }
  //
  // set token(value) {
  //   this.sqs('.token').innerHTML = value
  // }

  set image(value) {
    console.log(value);
    if (value === '[[item.image]]') return
    this.sqs('asset-player').src = value
  }

  get template() {
    return html`
  <style>
    :host {
      height: 120px;
      display: flex;
      flex-direction: row;
      pointer-events: auto;
      padding: 12px 24px;
      box-sizing: border-box;
      align-items: center;
      font-size: 24px;
    }

    asset-player {
      width: 96px;
      padding-right: 12px;
      border-radius: none;
    }
  </style>

  <asset-player></asset-player>
  <span class="symbol"></span>
  <flex-one></flex-one>
  <span class="tokenid"></span>

    `
  }
})
