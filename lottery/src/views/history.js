import TICKETS_ABI from './../../../abis/lotteryTickets'
import './../elements/lottery-tickets'
export default customElements.define('history-view', class historyView extends BaseClass {
  constructor() {
    super()
  }

  connectedCallback() {
    this._init()
  }

  get _arrayRepeat() {
    return this.shadowRoot.querySelector('array-repeat')
  }

  async _init() {
    await isApiReady()
    const lotteries = await api.contract.callStatic.lotteries()
    const contract = new ethers.Contract(api.addresses.lotteryTickets, TICKETS_ABI, api.connection.provider.getSigner())
    const ids = []
    const accounts = []
    for (let i = 1; i <= lotteries.toNumber(); i++) {
      ids.push(i)
      accounts.push(api.connection.accounts[0])
    }
    let balances = await contract.balanceOfBatch(accounts, ids)
    console.log(balances);
    let i = 0
    balances = balances.reduce((p, c) => {
      i++
      if (c.toNumber() > 0) p.push({lotteryId: i, tickets: c.toNumber()})
      return p
    }, [])
    this._arrayRepeat.items = balances
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
    max-width: 312px;
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

  array-repeat {
    height: 100%;
    width: 100%;
    overflow-y: auto;
    pointer-events: auto;
  }
  span[slot="content"] {
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    pointer-events: auto;
  }
</style>

<section class="container">
  <flex-row class="top">
    <h4>tickets</h4>
    <flex-one></flex-one>
  </flex-row>
  <flex-row class="bottom"></flex-row>
  <flex-row style="padding-top: 12px;">
    <h4>Lottery</h4>
    <flex-one></flex-one>
    <h4>tickets</h4>
  </flex-row>
  <array-repeat>
    <template>
      <a href="#!/tickets?lottery=[[item.lotteryId]]"><lottery-tickets-element data-tickets="[[item.tickets]]" data-lottery-id="[[item.lotteryId]]"></lottery-tickets-element></a>
    </template>
  </array-repeat>
</section>
<!-- lastwinner -->

<!-- tickets -->

<!-- buy tickets -->
    `
  }
})
