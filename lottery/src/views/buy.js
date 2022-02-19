import { lottery } from './../../node_modules/lucky-numbers/src/index';
import ARTONLINE_ABI from './../../../abis/artonline'
import ARTONLINE_GAMING_ABI from './../../../abis/gaming'

import './../elements/ticket'
export default customElements.define('buy-view', class BuyView extends BaseClass {
  constructor() {
    super()
    this._onInput = this._onInput.bind(this)
    this._approveAndBuy = this._approveAndBuy.bind(this)

  }

  connectedCallback() {
    this._init()
    this.shadowRoot.querySelector('input').addEventListener('input', this._onInput)
    this.items = []
  }

  async _init() {
    await isApiReady()
    const [id, status, prizePool, ticketPrice, prizeDistribution, startTime, endTime, winningNumbers] = await api.contract.callStatic.latestLottery()
    this.ticketPrice = ethers.utils.formatUnits(ticketPrice)
    this.id = id
    this.shadowRoot.querySelector('input').value = 1;
    this._onInput()
    this.shadowRoot.querySelector('.ticketPrice').innerHTML = `${this.ticketPrice} <img class="logo" src="https://assets.artonline.site/arteon.svg"></img>`
    this.shadowRoot.querySelector('[data-action="approveAndBuy"]').addEventListener('click', this._approveAndBuy)

  }

  async _approveAndBuy() {

          // const gaming = new ethers.Contract(api.addresses.gamingProxy, ARTONLINE_GAMING_ABI, api.connection.provider.getSigner())
          // let tx = gaming.deposit(ethers.utils.parseUnits('10000'))
          // await tx.wait()
    const contract = new ethers.Contract(api.addresses.gamingProxy, ARTONLINE_ABI, api.connection.provider.getSigner())
    // contract.transfer(api.addresses.gamingProxy, ethers.utils.parseUnits('1000'))
    let allowance = await contract.callStatic.allowance(api.connection.accounts[0], api.addresses.lotteryProxy)
    const amount = Number(this.shadowRoot.querySelector('input').value) * Number(this.ticketPrice)

    console.log(Number(ethers.utils.formatUnits(allowance)));
    if (Number(ethers.utils.formatUnits(allowance)) === 0) {
      tx = await contract.approve(api.addresses.lotteryProxy, ethers.utils.parseUnits(amount.toString()))
      await tx.wait()
    } else if (Number(ethers.utils.formatUnits(allowance)) < amount) {
      tx = await contract.increaseAllowance(api.addresses.lotteryProxy, ethers.utils.parseUnits(String(amount - Number(ethers.utils.formatUnits(allowance)))))
      await tx.wait()
    }

    let numbers = Array.from(this.shadowRoot.querySelector('array-repeat').querySelectorAll('ticket-element'))
    numbers = numbers.reduce((set, el) => {
      console.log(el.numbers);
      el.numbers.forEach(item => set.push(item))
      return set
    }, [])
    console.log(numbers);

    tx = await api.contract.buyTickets(this.id, this.shadowRoot.querySelector('input').value, numbers)
    console.log(tx);
  }

  _onInput() {
    let amount = this.shadowRoot.querySelector('input').value
    this.shadowRoot.querySelector('.cost').innerHTML = `${this.ticketPrice * amount} <img class="logo" src="https://assets.artonline.site/arteon.svg"></img>`

    if (amount < this.items.length) {
      this.items = this.items.slice(this.items.length - amount, this.items.length)
    }

    if (amount > this.items.length) {
      amount = amount - this.items.length
      for (let i = 1; i <= amount; i++) {
        const numbers = this.getNumber()
        this.items.push({numbers: numbers.join('')})
      }
    }
    this.shadowRoot.querySelector('array-repeat')._content.innerHTML = ''
    this.shadowRoot.querySelector('array-repeat').items = this.items
  }

  getNumber() {
    return lottery(6, 9)
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
    padding-bottom: 12px;
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

  .wrapper {
    background-color: rgb(238, 234, 244);
    border: 1px solid rgb(215, 202, 236);
    border-radius: 16px;
    box-shadow: rgb(74 74 104 / 10%) 0px 2px 2px -1px inset;
    padding: 8px 16px;
    display: flex;
    max-width: 230px;
  }

   flex-column {
     box-sizing: border-box;
     padding: 24px;
     width: 100%;
   }

   input {
     pointer-events: auto;
     background: transparent;
     border: none;
     width: 22px;
     -webkit-appearance: none;
     text-align: end;
     outline: none;
   }



   .logo {
     height: 18px;
     width: 18px;
     padding-left: 6px;
   }

   .ticketPrice, .cost {
     align-items: center;
     display: flex;
   }
   array-repeat {
     height: 100%;
     width: 100%;
     overflow-y: auto;
     pointer-events: auto;
   }

   span[slot="content"] {
     justify-content: center;
     width: 100%;
     display: flex;
     flex-direction: column;
     align-items: center;
     overflow-y: auto;
     pointer-events: auto;
   }
</style>

<section class="container">
  <flex-row class="top">
    <h4>buy tickets</h4>
    <flex-one></flex-one>
    <custom-svg-icon icon="cancel"></custom-svg-icon>
  </flex-row>
  <flex-row class="bottom"></flex-row>

  <flex-column>
    <span class="wrapper">
      <flex-one></flex-one>
      <input value="0"></input>
    </span>
  </flex-column>



  <!-- <flex-row>
    <button data-action="amount" data-value="1">1</button>
    <button data-action="amount" data-value="5">5</button>
    <button data-action="max" data-value="max">max</button>
  </flex-row> -->
  <array-repeat>
    <template>
      <ticket-element numbers="[[item.numbers]]"></ticket-element>
    </template>
  </array-repeat>

  <flex-row style="padding: 12px 24px 0 24px;">
    <h4>price/ticket</h4>
    <flex-one></flex-one>
    <span class="ticketPrice"></span>
  </flex-row>
  <flex-row style="padding: 0 24px 12px 24px;">
    <h4>cost</h4>
    <flex-one></flex-one>
    <span class="cost"></span>
  </flex-row>
  <button data-action="approveAndBuy">aprove & buy</button>
</section>
<!-- lastwinner -->

<!-- tickets -->

<!-- buy tickets -->
    `
  }
})
