export default customElements.define('lottery-tickets-element', class LotteryTicketsElement extends BaseClass {
  constructor() {
    super()
  }

  connectedCallback() {
    console.log(this.dataset);
    this.sqs('.id').innerHTML = `#${this.dataset.lotteryId}`
    this.sqs('.tickets').innerHTML = `${this.dataset.tickets}`
  }

  get template() {
    return html`
    <style>
      * {
        user-select: none;
        pointer-events: none;
      }
      :host {
        display: flex;
        height: 56px;
        width: 100%;
        padding: 8px 48px;
        box-sizing: border-box;
        pointer-events: auto;
        cursor: pointer;
      }

      .container {
        display: flex;
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #888;
        border-radius: 12px;
        padding: 8px 16px;
      }
    </style>

    <span class="container">
      <strong class="id"></strong>
      <flex-one></flex-one>
      <span class="tickets"></span>
    </span>
    `
  }
})
