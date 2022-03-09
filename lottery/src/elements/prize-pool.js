export default customElements.define('prize-pool', class PrizePool extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  set value(value) {
    (async () => {
      const price = await api.getPrice()
      this.shadowRoot.querySelector('[info="pot"]').innerHTML = Math.round(Number(ethers.utils.formatUnits(value)))
      this.shadowRoot.querySelector('[info="usd"]').innerHTML = `${Math.round(Number(price) * Number(ethers.utils.formatUnits(value)))} USD`
    })()
  }

  get template() {
    return html`
    <style>
      :host {
        display: flex;
        align-items: baseline;
        padding: 24px 48px;
        box-sizing: border-box;
        width: 100%;
      }
      h4 {
        margin: 0;
      }

      .logo {
        height: 24px;
        width: 24px;
        padding: 12px;
        pointer-events: auto;
      }

      [info="pot"] {
        font-weight: 600;
        font-size: 24px;
        color: #9140cf;
      }
    </style>
      <flex-column style="width: 192px;">
        <h4>Lottery Pot</h4>
      </flex-column>


      <flex-one></flex-one>
      <flex-column>

        <flex-row style="align-items: center;">
          <span info="pot">0</span>
          <img class="logo" src="https://assets.artonline.site/arteon.svg">
        </flex-row>

        <flex-row style="padding:0;">
          <span>+-</span>
          <span info="usd">0</span>
        </flex-row>
      </flex-column>
    `
  }
})
