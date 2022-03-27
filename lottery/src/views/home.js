import './../elements/countdown'
import './../elements/prize-pool'
import ART_ABI from './../../../abis/artonline'
export default customElements.define('home-view', class HomeView extends BaseClass {
  constructor() {
    super()
    this._buyTickets = this._buyTickets.bind(this)
  }

  connectedCallback() {
    this._init()
    this._userTicketCount = 0
  }

  get hour() {
    return 60
  }

  set _endTime(value) {
    this.shadowRoot.querySelector('custom-countdown').value = value
  }

  get _endTime() {
    return this.shadowRoot.querySelector('custom-countdown').value
  }

  set _id(value) {
    this.shadowRoot.querySelector('span[info="id"]').innerHTML = `#${value}`
  }

  get _id() {
    return this.shadowRoot.querySelector('span[info="id"]').innerHTML.split('#')[1]
  }

  set _prizePool(value) {
    this.shadowRoot.querySelector('prize-pool').value = value
  }

  set _inUSD(value) {
    this.shadowRoot.querySelector('span[info="usd"]').innerHTML = `${Math.round(value * 100) / 100} USD`
  }

  set _userTicketCount(value) {
    this.shadowRoot.querySelector('span[info="userTicketCount"]').innerHTML = String(value)
  }

  get _userTicketCount() {
    return Number(this.shadowRoot.querySelector('span[info="userTicketCount"]').innerHTML)
  }

  set winningNumbers(value) {
    this.shadowRoot.querySelector('[info="winningNumbers"]').innerHTML = value
  }


  async _init() {
    await isApiReady()
    if (!api.connection) await document.querySelector('lottery-shell')._select('connect')
    const info = await api.contract.latestLottery()
    this._endTime = info.endTime.toNumber()
    this._id = info.id.toNumber()
    this._prizePool = info.prizePool


    const ticketsSold = await api.ticketsContract.callStatic.totalSupply(info.id)
    this.shadowRoot.querySelector('[info="tickets-sold"]').innerHTML = ticketsSold
    this.shadowRoot.querySelector('button[data-action="buyTickets"]').addEventListener('click', this._buyTickets)

    const timeout = () => setTimeout(async () => {
      this._endTime = this._endTime > 0 ? this._endTime : 0


      timeout()
    }, 1000);
    timeout()
    const tickets = await api.getBalance(this._id)
    if (tickets.toNumber() > 0) {
      this._userTicketCount = tickets.toString()
      if (!this.shadowRoot.querySelector('.userTicketCount').querySelector('.userTicketCountButton')) {
        const a = document.createElement('a')
        a.innerHTML = '<button style="padding: 6px 12px;">view</button>'
        a.href= `#!/tickets?lottery=${this._id}`
        a.class= 'userTicketCountButton'
        this.shadowRoot.querySelector('.userTicketCount').appendChild(a)
      }
    }

  }

  async _buyTickets() {
    if (!api.connection) await document.querySelector('lottery-shell')._select('connect')
    location.hash = '#!/buy'
    // document.querySelector('lottery-shell')._select('buy')
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
    flex-direction: column;
  }
  h4 {
    margin: 0;
  }
  section {
    width: 100%;
    height: 320px;
    padding-bottom: 24px;
  }
  .container {
    background: var(--secondary-background-color);
    max-width: 400px;
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

  .header {
    padding-top: 24px;
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

  flex-column {
    width: 100%;
  }
  [info="pot"] {
    font-weight: 600;
    font-size: 24px;
    color: #9140cf;
  }

  .logo {
    height: 24px;
    width: 24px;
    padding: 12px;
    pointer-events: auto;
  }

  .previousLottery {
    margin-top: 48px;
    max-height: 164px;
    height: 100%;
  }

  strong {
    padding-top: 12px;
    font-size: 20px;
  }
</style>

<section class="container">
  <flex-column class="header">
  <flex-row>
    <h4>lottery</h4>
    <flex-one></flex-one>
    <span info="id"></span>
  </flex-row>
  <flex-row>
    <h4>Next draw in</h4>
    <flex-one></flex-one>
    <custom-countdown info="countdown"></custom-countdown>
  </flex-row>
  </flex-column>
  <prize-pool></prize-pool>
  <flex-row style="align-items: baseline; height: 34px;">
    <flex-column style="max-width: 120px;">
      <h4>Tickets Sold</h4>
    </flex-column>
    <span info="tickets-sold">0</span>
    <flex-one></flex-one>
  </flex-row>

  <flex-row style="align-items: baseline; height: 34px;">
    <flex-column style="max-width: 120px;">
      <h4>Your Tickets</h4>
    </flex-column>

    <flex-column>
      <flex-row style="padding: 0;" class="userTicketCount">
        <span info="userTicketCount">0</span>
        <flex-one></flex-one>
      </flex-row>
    </flex-column>

    <flex-one></flex-one>
  </flex-row>

  <flex-one></flex-one>
  <flex-row class="button-container">
    <flex-one></flex-one>
    <button data-action="buyTickets">buy tickets</button>
    <flex-one></flex-one>
  </flex-row>
</section>


<!-- lastwinner -->

<!-- tickets -->

<!-- buy tickets -->
    `
  }
})
