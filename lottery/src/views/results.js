import TICKETS_ABI from './../../../abis/lotteryTickets'
import './../elements/ticket'
import './../elements/prize-pool'
export default customElements.define('results-view', class resultsView extends BaseClass {
  constructor() {
    super()
    this._previous = this._previous.bind(this)
    this._next = this._next.bind(this)
    this._claim = this._claim.bind(this)
  }

  connectedCallback() {
    this.load()
    this.shadowRoot.querySelector('[icon="chevron-left"]').addEventListener('click', this._previous)
    this.shadowRoot.querySelector('[icon="chevron-right"]').addEventListener('click', this._next)
  }

  async _claim(event, tickets) {
    alert('claimin')
    if (!tickets) tickets = this._userTickets_.map(({ticket}) => ticket)
    let batch = []
    alert('tickets')
    if (tickets.length > 50) batch = tickets.splice(0, 50)
    else batch = tickets

    let tx = await api.contract.batchClaimRewards(api.connection.accounts[0], this.lottery, batch)

    await tx.wait()
    if (batch.length === 50) return this._claim(null, tickets)
  }

  _previous() {
    if (this.lottery - 1 > 0) this.load(this.lottery - 1)
  }

  _next() {
    if (this.lottery + 1 <= this.lotteries - 1) this.load(this.lottery + 1)
  }

  async load(lottery) {
    if (this.shadowRoot.querySelector('.container').querySelector('button')) {
      this.shadowRoot.querySelector('.container').querySelector('button').removeEventListener('click', this._claim)
      this.shadowRoot.querySelector('.container').removeChild(this.shadowRoot.querySelector('.container').querySelector('button'))
    }
    console.log(lottery);
    await isApiReady()
    if (!api.connection) await document.querySelector('lottery-shell')._select('connect')
    if (!lottery) {
      const lotteries = await api.contract.callStatic.lotteries()
      lottery = lotteries.toNumber() - 1


      this.lotteries = lotteries.toNumber()
    }
    this.lottery = lottery
    this.shadowRoot.querySelector('[info="id"]').innerHTML = `${lottery} / ${this.lotteries - 1}`
    let promises = [
      api.contract.callStatic.lottery(lottery),
      api.ticketsContract.callStatic.totalSupply(lottery),
      api.ticketsContract.callStatic.tickets(lottery, api.connection.accounts[0]),
    ]

    promises = await Promise.all(promises)

    this.shadowRoot.querySelector('prize-pool').value = promises[0].prizePool
    this.shadowRoot.querySelector('ticket-element').numbers = promises[0].winningNumbers.join('')
    this.shadowRoot.querySelector('[info="tickets-sold"]').innerHTML = promises[1]
    this.shadowRoot.querySelector('[info="user-tickets"]').innerHTML = promises[2].length

    const tickets = promises[2]
    const winningNumbers = promises[0].winningNumbers.join('')
    promises = []
    for (const ticket of tickets) {
      promises.push(api.ticketsContract.callStatic.getTicketNumbers(lottery, ticket))
    }
    promises = await Promise.all(promises)
    promises = promises.reduce((p, c, i) => {
      c = c.join('')
      if (c.charAt(0) === winningNumbers.charAt(0) ||
          c.charAt(1) === winningNumbers.charAt(1) ||
          c.charAt(2) === winningNumbers.charAt(2) ||
          c.charAt(3) === winningNumbers.charAt(3) ||
          c.charAt(4) === winningNumbers.charAt(4) ||
          c.charAt(5) === winningNumbers.charAt(5)
        ) p.push(i + 1)
      return p
    }, [])

    this._userTickets_ = []
    if (promises.length > 0) {
      const _promises = promises
      promises = []
      for (const ticket of _promises) {
        this._userTickets_.push({lottery, ticket})
        promises.push(api.ticketsContract.callStatic.claimed(lottery, ticket))
      }
      promises = await Promise.all(promises)
      this._userTickets_ = this._userTickets_.reduce((set, c, i) => {
        if (promises[i] === false) set.push({...c})
        return set
      }, [])
      if (this._userTickets_.length > 0) {
        const button = document.createElement('button')
        button.innerHTML = 'claim tickets'
        this.shadowRoot.querySelector('.container').appendChild(button)
        this.shadowRoot.querySelector('.container').querySelector('button').addEventListener('click', this._claim)
      }
    }
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
    max-height: 680px;
  }
  .container {
    background: var(--secondary-background-color);
    max-width: 380px;
    border-radius: 48px;
    box-shadow: 0 0 7px 9px #00000012;
    overflow: hidden;
    align-items: center;
    box-sizing: border-box;
    padding-bottom: 24px;
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

  .winningNumbers {
    padding: 24px 48px;
  }

  ticket-element, button {
    margin-top: 24px;
  }

  custom-svg-icon {
    pointer-events: auto;
    background: #fff;
    border-radius: 50%;
    padding: 6px;
    box-sizing: border-box;
    height: 40px;
    width: 40px;
  }

  button {
    pointer-events: auto;
  }
</style>

<section class="container">
<flex-row class="top">
  <h4>lottery</h4>
  <flex-one></flex-one>
  <span info="id"></span>
</flex-row>

<flex-row class="bottom">
</flex-row>

<prize-pool></prize-pool>
<flex-row>
  <h4>Tickets Sold</h4>
  <flex-one></flex-one>
  <span info="tickets-sold"></span>
</flex-row>
<flex-row>
  <h4>Your Tickets</h4>
  <flex-one></flex-one>
  <span info="user-tickets"></span>
</flex-row>
<ticket-element></ticket-element>
</section>

<flex-row style="max-width: 380px; margin-top: 24px;">
  <custom-svg-icon icon="chevron-left"></custom-svg-icon>
  <flex-one></flex-one>
  <custom-svg-icon icon="chevron-right"></custom-svg-icon>
</flex-row>
<!-- lastwinner -->

<!-- tickets -->

<!-- buy tickets -->
    `
  }
})
