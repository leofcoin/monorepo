import './../../node_modules/@andrewvanardennen/custom-input/custom-input'

export default customElements.define('home-view', class HomeView extends BaseClass {
  constructor() {
    super()
    this._onclick = this._onclick.bind(this)
  }

  connectedCallback() {
    this.shadowRoot.querySelector('button').addEventListener('click', this._onclick)
  }

  async _onclick() {
    const value = this.shadowRoot.querySelector('custom-input').input.value
    let response = await fetch(`https://api.artonline.site/faucet?address=${value}`)
    console.log(await response.text());
  }

  get template() {
    return html`
<style>
  * {
    font-family: 'Noto Sans', sans-serif;
  }
  :host {
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
  }
  h4 {
    margin: 0;
  }
  section {
    width: 100%;
    height: 220px;
    padding-bottom: 24px;
  }
  .container {
    background: var(--secondary-background-color);
    max-width: 480px;
    border-radius: 48px;
    box-shadow: 0 0 7px 9px #00000012;
    overflow: hidden;
  }
  .container, section {
    display: flex;
    flex-direction: column;
    width: 100%;


    align-items: center;
    justify-content: center;
  }

  flex-row {
    width: 100%;
    align-items: center;

    box-sizing: border-box;
    padding: 0 48px;
  }

  .top {
    padding-top: 24px;
    background: #573e6a;
    color: #eee;
  }

  .bottom {
    padding-bottom: 24px;
    background: #573e6a;
    color: #eee;
  }

  button {
    background: #573e6a;
    padding: 12px 24px;
    box-sizing: border-box;
    border-radius: 12px;
    color: #eee;
    border-color: #eee;
    font-weight: 700;
    text-transform: uppercase;
    pointer-events: auto;
    cursor: pointer;
  }

  custom-input {
    width: 100%;
    pointer-events: auto;
    max-width: 332px;
    border-radius: 12px;
  }
</style>

<section class="container">
  <h1>ArtOnline Faucet</h1>
<flex-one></flex-one>
  <custom-input placeholder="address"></custom-input>
  <flex-two></flex-two>
  <button>GET ART</button>
</section>
    `
  }
})
