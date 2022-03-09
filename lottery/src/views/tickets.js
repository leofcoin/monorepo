import TICKETS_ABI from './../../../abis/lotteryTickets'
import './../elements/ticket'
export default customElements.define('tickets-view', class ticketsView extends BaseClass {
  constructor() {
    super()
  }

  get _arrayRepeat() {
    return this.shadowRoot.querySelector('array-repeat')
  }

  async load(lottery) {
    this._arrayRepeat.reset()
    this.shadowRoot.querySelector('[info="id"]').innerHTML = `#${lottery}`
    await isApiReady()
    if (!api.connection) await document.querySelector('lottery-shell')._select('connect')
    const tickets = await api.getTickets(lottery)

    this.shadowRoot.querySelector('[info="tickets"]').innerHTML = `${tickets.length}`
    const items = []
    console.log(tickets);
    let promises = []
    for (const id of tickets) {
      promises.push(api.getTicketNumbers(lottery, id))
    }
    promises = await Promise.all(promises)
    for (const id of tickets) {
      items.push({id, numbers: promises[tickets.indexOf(id)].join('')})
    }

    console.log(items);
    this._arrayRepeat.items = items
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
    max-height: 480px;
  }
  .container {
    background: var(--secondary-background-color);
    max-width: 312px;
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
    margin-bottom: 24px;
  }

  array-repeat {
    height: 100%;
    width: 100%;
    overflow-y: auto;
    pointer-events: auto;
    align-items: center;
  }

  ticket-element {
    pointer-events: none;
  }

  span[slot="content"] {
    justify-content: center;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    pointer-events: auto;
    padding: 8px 0;
  }
</style>

<section class="container">
<flex-row class="top">
  <h4>lottery</h4>
  <flex-one></flex-one>
  <span info="id"></span>
</flex-row>
<flex-row class="bottom">
  <h4>Tickets</h4>
  <flex-one></flex-one>
  <span info="tickets"></span>
</flex-row>
<flex-one></flex-one>
  <array-repeat>
    <template>
      <ticket-element numbers="[[item.numbers]]" edit="false"></ticket-element>
    </template>
  </array-repeat>
</section>
<!-- lastwinner -->

<!-- tickets -->

<!-- buy tickets -->
    `
  }
})
