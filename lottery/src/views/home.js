import './../elements/countdown'
import './../elements/prize-pool'
export default customElements.define('home-view', class HomeView extends BaseClass {
  constructor() {
    super()
    this._buyTickets = this._buyTickets.bind(this)
    this.updateInfo = this.updateInfo.bind(this)
  }

  connectedCallback() {
    this._init()
  }

  get hour() {
    return 60
  }

  set _endTime(value) {
    this.shadowRoot.querySelector('custom-countdown').value = value

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
    this.shadowRoot.querySelector('span[info="userTicketCount"]').innerHTML = value
  }

  set winningNumbers(value) {
    this.shadowRoot.querySelector('[info="winningNumbers"]').innerHTML = value
  }

  async updateInfo() {
    const [id, status, prizePool, ticketPrice, prizeDistribution, startTime, endTime, winningNumbers] = await api.contract.callStatic.latestLottery()

    this._endTime = endTime.toNumber()
    this._id = id.toNumber()
    this._prizePool = prizePool
    const price = await api.getPrice()
    // this._inUSD = Number(price) * Number(ethers.utils.formatUnits(prizePool))


    // if (this.shadowRoot.querySelector('.userTicketCountButton') && tickets.toNumber() === 0) this.shadowRoot.querySelector('.userTicketCount').removeChild(this.shadowRoot.querySelector('.userTicketCountButton'))

    // if (Number(this._id) > 1) {
    //   const lastResult = await api.contract.lottery(Number(this._id) - 1)
    //   const numbers = lastResult.winningNumbers.map(number => number.toString())
    //
    //   this.winningNumbers = numbers.join(' ')
    // }
  }


  async _init() {
    await isApiReady()
    if (!api.connection) await document.querySelector('lottery-shell')._select('connect')
    await this.updateInfo()

    this.shadowRoot.querySelector('button[data-action="buyTickets"]').addEventListener('click', this._buyTickets)

    const timeout = () => setTimeout(async () => {
      await this.updateInfo()


      timeout()
    }, 60000);
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
    document.querySelector('lottery-shell')._select('buy')
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
    <flex-column style="width: 192px;">
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
