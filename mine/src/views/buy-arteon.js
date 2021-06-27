import './../elements/swap-coin'
import './../elements/swap-button'
import './../elements/swap-price'
import './../elements/swap-status'
import './../elements/swap-title'

export default customElements.define('buy-arteon-view', class BuyArteonView extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template.innerHTML

    this._onswap = this._onswap.bind(this)
    this._swapInOut = this._swapInOut.bind(this)
  }

  get _sellCoin() {
    return this.shadowRoot.querySelector('.sell')
  }

  get _buyCoin() {
    return this.shadowRoot.querySelector('.buy')
  }

  get _title() {
    return this.shadowRoot.querySelector('swap-title')
  }

  get _swap() {
    return this.shadowRoot.querySelector('custom-svg-icon')
  }

  _swapInOut() {
    const sell = this.sell
    this._sellCoin.selected = this.buy
    this._buyCoin.selected = sell
  }

  connectedCallback() {
    /**
     *
     */
    pubsub.subscribe('swap.buy', value => {
      console.log({buy: value});
      this.buy = value
      this._title.tokenIn = value
      this._observeSwap()
    })
    pubsub.subscribe('swap.sell.coin', value => {
      this.sell = value
      this._title.tokenOut = value
      this._observeSwap()
    })

    pubsub.subscribe('swap.sell.amount', value => {
      this.amount = value
      this._observeSwap()
    })

    pubsub.subscribe('swap.approve', value => {
      this.swapButton.innerHTML = value.approved ? 'swapping...' : 'approve failed'
      css.notificationManager.show(`${value.approved ? 'approved' : 'approve failed'} ${value.amount}${value.token.symbol}`)
    })

    this.shadowRoot.querySelector('swap-button').addEventListener('click', this._onswap)
    this._swap.addEventListener('click', this._swapInOut)
    this.reset()
  }

  async _observeSwap() {
    if (!this.sell) return this.swapButton.innerHTML = 'select coin to sell'

    const balance = await api.balanceOf(this.sell, api.signer.address)
    const balanceToken1 = await api.balanceOf(this.buy, api.signer.address)
    if (String(balance) === '0') return this.swapButton.innerHTML = "You don't have any coins"

    this.shadowRoot.querySelector('.sell').balance.balance = balance

    if (!this.buy) return this.swapButton.innerHTML = 'select coin to buy'
    if (this.buy === this.sell) return this.swapButton.innerHTML = 'select a different token'
    if (this.buy && this.sell) {
      pubsub.publish('swap.price', {
        price: await api.price(this.buy, this.sell),
        pair: [this.sell, this.buy]
      })
    }
    if (!this.amount) return this.swapButton.innerHTML = 'enter amount to sell'
    let amount = String(this.amount)
    const enoughBalance = await api.enoughBalance(this.sell, this.amount)
    if (!enoughBalance) return this.swapButton.innerHTML = 'amount exceeds balance'

    if (this.sell && this.amount && this.buy) {

      this.swapButton.innerHTML = 'swap'
      this.swapButton.disabled = false

      console.log(this.buy, this.sell);
      let priceToToken1
      let priceToToken0
      // let { price, buyAmount, estimatedGas, sources } =
      if (this.buy === 'WETH' && this.sell === 'ETH') {
        priceToToken1 = amount
        priceToToken0 = amount
      } else {

         const [executionPrice, nextPrice] = await api.tradePrice(this.buy, this.sell, api.parseUnits(amount, api.tokenInfo(this.sell).decimals))
         console.log(executionPrice, nextPrice);

         pubsub.publish('swap.sell.balance', balance)
         pubsub.publish('swap.buy.balance', balanceToken1)
      }
      // console.log();
      // if (!sources) return alert('no source found for' + this.sell)
      // const dex = sources.filter(c => Number(c.proportion) === 1)
      // price
      // console.log(dex);
      // console.log(price);





      // pubsub.publish('swap.estimatedGas', web3.utils.fromWei(String(estimatedGas)))
      // pubsub.publish('swap.dex', dex[0].name)
    }
  }

  get swapButton() {
    return this.shadowRoot.querySelector('swap-button')
  }

  get zeroX() {
    return document.querySelector('custom-zerox')
  }

  async _onswap() {
    console.log('click');
    if (this.buy && this.sell && this.amount) {
      this.swapButton.innerHTML = 'approving...'
      const exchange = await api.exchange(this.buy, this.sell, String(this.amount))
      try {
        await exchange.approve()

        // pubsub.publish('swap.approve', {
        //   approved: true,
        //   amount: this.amount,
        //   sell: this.sell
        // })

        await exchange.swap()

        let assets = []
        if (await css.accountStore.has('assets')) assets = await css.accountStore.get('assets')
        if (assets.indexOf(this.buy) === -1) assets.push(this.buy)
        if (String(api.balanceOf(this.sell)) === '0') assets.slice(assets.indexOf(this.sell), 1)
        await css.accountStore.put('assets', assets)
        this.reset()
      } catch (e) {
        // pubsub.publish('swap.approve', {
        //   approved: false,
        //   amount: this.amount,
        //   sell: this.sell
        // })
      }
    }

  }

  reset() {
    this.swapButton.innerHTML = 'select coin to buy'
    console.log(this._sellCoin);
    this._sellCoin.selected = this.lastSelectedSell || 'WETH'
    this._sellCoin.input.value = '0.0'
    this.swapButton.disabled = true
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
      }

      custom-svg-icon {
        cursor: pointer;
        pointer-events: auto;
        --svg-icon-color: var(--accent-color);
      }

      .main-hero {
        flex-direction: column;
        max-width: 420px;
        max-height: 420px;
        width: 100%;
        padding: 12px 24px 24px;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;
        z-index: 1;
        position: relative;
      }

      custom-pages {
        width: 100%;
        align-items: center;
        justify-content: center;
        height: 100%;
        display: flex;
        padding: 24px;
        box-sizing: border-box;
      }

      section {
        border: none;
        border-bottom: 1px solid #888;
        max-width: 320px;
        padding-bottom: 24px;
        box-sizing: border-box;
        padding-top: 48px;
      }

      swap-coin {
        max-width: 420px;
      }

      swap-button {
        z-index: 101;
        box-shadow: 0 3px 4px 0 rgba(0, 0, 0, 0.14),
                    0 1px 8px 0 rgba(0, 0, 0, 0.12),
                    0 3px 3px -2px rgba(0, 0, 0, 0.4);
        --button-border-color: transparent;
      }

      .status {
        border-top-right-radius: 0;
        border-top-left-radius: 0;
        background: #1072f9bf;
        height: 0px;
        opacity: 0;
        pointer-events: none;
        max-width: 364px;
      }

      @media (max-width: 460px) {
        .status {
          width: calc(100% - 48px);
        }
      }
    </style>
    <custom-pages attr-for-selected="data-route">
      <custom-hero data-route="swap" class="main-hero">
        <swap-title></swap-title>
        <swap-coin event="swap.sell" class="sell"></swap-coin>
        <flex-one></flex-one>
        <custom-svg-icon icon="swap-vertical"></custom-svg-icon>
        <flex-one></flex-one>
        <swap-coin event="swap.buy" buy class="buy"></swap-coin>
        <flex-two></flex-two>
        <swap-price event="swap.price"></swap-price>
        <flex-two></flex-two>
        <swap-button>enter amount</swap-button>
      </custom-hero>

      <custom-hero data-route="settings" class="main-hero">

      </custom-hero>
    </custom-pages>

    <custom-hero class="status">
      <swap-status></swap-status>
    </custom-hero>

    `

    // <flex-row style="width:100%;"><strong>dex</strong><flex-one></flex-one><pubsub-text event="swap.dex"></pubsub-text></flex-row>
  }
})
