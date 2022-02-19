

export default customElements.define('home-view', class HomeView extends BaseClass {
  constructor() {
    super()
    this._buyTickets = this._buyTickets.bind(this)
  }

  connectedCallback() {
    this._init()
  }

  get hour() {
    return 60
  }

  set _endTime(value) {
    const currentTime = Math.round(new Date().getTime() / 1000)
    value = value - currentTime
    const hours = Math.floor((value % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((value % (60 * 60)) / (60));

    if (hours !== 0) {
      value = `${hours} ${hours > 1 ? 'hours' : 'hour'} ${minutes} ${minutes > 1 ? 'minutes' : 'minute'}`
    } else {
      value = `${minutes} ${minutes > 1 ? 'minutes' : 'minute'}`
    }
    this.shadowRoot.querySelector('span[info="countdown"]').innerHTML = value
  }

  set _id(value) {
    this.shadowRoot.querySelector('span[info="id"]').innerHTML = `#${value}`
  }

  set _prizePool(value) {
    this.shadowRoot.querySelector('span[info="pot"]').innerHTML = `${value} ART`
  }

  async _init() {
    await isApiReady()
    const [id, status, prizePool, ticketPrice, prizeDistribution, startTime, endTime, winningNumbers] = await api.contract.callStatic.latestLottery()

    this._endTime = endTime.toNumber()
    this._id = id.toNumber()
    this._prizePool = ethers.utils.formatUnits(prizePool)

    this.shadowRoot.querySelector('button[data-action="buyTickets"]').addEventListener('click', this._buyTickets)
    const timeout = () => setTimeout(async () => {
      this._endTime = endTime.toNumber()
      const result = await api.contract.callStatic.latestLottery()
      this._prizePool = ethers.utils.formatUnits(result[2])
      timeout()
    }, 60000);
    timeout()

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
  }
  h4 {
    margin: 0;
  }
  section {
    width: 100%;
    height: 480px;
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
</style>

<section class="container">
  <flex-row class="top">
    <h4>lottery</h4>
    <flex-one></flex-one>
    <span info="id"></span>
  </flex-row>
  <flex-row class="bottom">
    <h4>Next draw in</h4>
    <flex-one></flex-one>
    <span info="countdown"></span>
  </flex-row>
  <flex-one></flex-one>
  <span info="pot"></span>
<flex-one></flex-one>
  <span>
    <flex-row>
      <lottery-info info="pot"></lottery-info>
    </flex-row>
    <button data-action="buyTickets">buy tickets</button>
  </span>
</section>
<!-- lastwinner -->

<!-- tickets -->

<!-- buy tickets -->
    `
  }
})
