import { css, html, LitElement } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { getSelectedNetwork } from '../network-selection.js'
import { errorMessage, networkStatus } from '../controllers/transfer.js'
import {
  addDexLiquidity,
  discoverDexFactories,
  executeSwap,
  formatTokenAmount,
  genesisDexFactory,
  loadDexPools,
  quoteSwap,
  removeDexLiquidity,
  validateFactory,
  type ChainLike,
  type DexPool
} from '../controllers/dex-trading.js'
import { viewPolish } from './view-polish.js'

type Wallet = { selectedAccount?: string }
type SwapQuote = Awaited<ReturnType<typeof quoteSwap>>
const QUOTE_LIFETIME = 2 * 60_000

const shortAddress = (address = '') => address.length > 22 ? `${address.slice(0, 10)}…${address.slice(-8)}` : address

@customElement('dex-view')
export class DexView extends LitElement {
  @property({ type: Object }) accessor wallet: Wallet | undefined
  @state() accessor factory = ''
  @state() accessor factoryInput = ''
  @state() accessor pools: DexPool[] = []
  @state() accessor selectedPoolAddress = ''
  @state() accessor tokenIn = ''
  @state() accessor amountIn = ''
  @state() accessor slippage = '0.5'
  @state() accessor quote: SwapQuote | undefined
  @state() accessor reviewing = false
  @state() accessor quoting = false
  @state() accessor transactionHash = ''
  @state() accessor canonicalFactory = ''
  @state() accessor amount0 = ''
  @state() accessor amount1 = ''
  @state() accessor removeLiquidityAmount = ''
  @state() accessor mode: 'trade' | 'liquidity' = 'trade'
  @state() accessor loading = true
  @state() accessor busy = false
  @state() accessor error = ''
  @state() accessor message = ''
  #request = 0
  #quoteRequest = 0
  #quoteTimer?: ReturnType<typeof setTimeout>
  #expiryTimer?: ReturnType<typeof setTimeout>
  #quoteContext?: { current: () => boolean; deadline: number }

  get #chain(): ChainLike { return globalThis.chain as unknown as ChainLike }

  static styles = [viewPolish, css`
    main { max-width: 560px; gap: 14px; }
    .dex-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h1 { margin: 0; }
    .swap-card { display: grid; gap: 12px; }
    .swap-card .section-title { margin: 0; }
    .swap-card input.amount { font-size: clamp(23px, 6vw, 34px); font-variant-numeric: tabular-nums; }
    .estimate { min-height: 38px; font-size: clamp(20px, 5vw, 30px); overflow-wrap: anywhere; }
    .swap-action { width: 100%; min-height: 49px; }
    .token-head > *, .quote-row > * { min-width: 0; overflow-wrap: anywhere; }
    .quote-row strong { text-align: right; }
    .details { padding: 0 16px; }
    .details summary { font-weight: 600; }
    .details .detail-body { gap: 10px; }
    .tabs { display: flex; gap: 6px; padding: 5px; border: 1px solid var(--lfc-glass-border, #51474e);
      border-radius: 16px; background: var(--lfc-glass-surface, #242126); }
    .tabs button { flex: 1; background: transparent; color: inherit; }
    .tabs button[aria-pressed='true'] { background: var(--lfc-action, #1d64d8); color: var(--lfc-on-action, #fff); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    label { display: grid; gap: 7px; color: var(--md-sys-color-on-surface-variant, #ccc); font-size: 13px; font-weight: 600; }
    input, select { width: 100%; min-width: 0; min-height: 48px; padding: 10px 14px; margin: 0; border-radius: 12px;
      border: 1px solid var(--lfc-glass-border, #51474e); background: var(--md-sys-color-surface-container, #171619); color: inherit; font: inherit; font-size: 16px; }
    .token-box { display: grid; gap: 8px; padding: 16px; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 16px; }
    .token-head, .quote-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .token-head strong { font-size: 17px; }
    .balance { font-variant-numeric: tabular-nums; }
    .swap-direction { width: 44px; min-height: 44px; padding: 0; margin: -4px auto; border-radius: 50%; }
    .pool-overview { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
    .pool-overview > div, .review { display: grid; gap: 5px; padding: 13px; border-radius: 13px;
      background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 8%, transparent); min-width: 0; }
    .pool-overview strong { overflow-wrap: anywhere; }
    .review { gap: 12px; margin-top: 16px; }
    .factory-form { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: end; }
    .factory-form button { margin-bottom: 0; }
    @media (max-width: 620px) {
      .form-grid, .pool-overview { grid-template-columns: 1fr; }
      .factory-form { grid-template-columns: 1fr; }
    }
  `]

  connectedCallback() {
    super.connectedCallback()
    void this.#initialize()
  }

  disconnectedCallback() {
    this.#request++
    this.#invalidateQuote()
    super.disconnectedCallback()
  }

  updated(changed: Map<string, unknown>) {
    const previous = changed.get('wallet') as Wallet | undefined
    if (changed.has('wallet') && previous?.selectedAccount !== this.wallet?.selectedAccount) {
      this.#invalidateQuote()
      if (this.factory) void this.#refreshPools()
    }
  }

  get #storageKey() { return `leofcoin:dex-factory:${getSelectedNetwork().key}` }
  get #pool() { return this.pools.find(pool => pool.address === this.selectedPoolAddress) }
  get #tokenOut() {
    const pool = this.#pool
    return pool && this.tokenIn === pool.token0 ? pool.token1Info : pool?.token0Info
  }

  async #initialize() {
    const request = ++this.#request
    this.loading = true
    this.error = ''
    try {
      const chain = this.#chain
      if (!chain) throw new Error('Unlock your wallet and wait for the node to start.')
      const canonical = await genesisDexFactory(chain)
      const saved = localStorage.getItem(this.#storageKey) || ''
      let factory = canonical || saved
      if (saved && !canonical) {
        try { await validateFactory(chain, factory) }
        catch { factory = '' }
      }
      if (request !== this.#request) return
      this.canonicalFactory = canonical || ''
      this.factory = factory
      this.factoryInput = factory
      if (factory) {
        localStorage.setItem(this.#storageKey, factory)
        await this.#refreshPools(request)
      }
    } catch (error) {
      if (request === this.#request) this.error = errorMessage(error)
    } finally {
      if (request === this.#request) this.loading = false
    }
  }

  async #saveFactory() {
    if (this.busy || this.canonicalFactory) return
    const factory = this.factoryInput.trim()
    this.busy = true
    this.error = ''
    this.message = ''
    try {
      await validateFactory(this.#chain, factory)
      this.pools = []
      this.selectedPoolAddress = ''
      this.amountIn = this.amount0 = this.amount1 = this.removeLiquidityAmount = ''
      this.factory = factory
      localStorage.setItem(this.#storageKey, this.factory)
      await this.#refreshPools()
      this.message = 'DEX factory connected.'
    } catch (error) { this.error = errorMessage(error) }
    finally { this.busy = false }
  }

  async #discover() {
    if (this.busy || this.canonicalFactory) return
    this.busy = true
    this.error = ''
    this.message = ''
    try {
      const factories = await discoverDexFactories(this.#chain)
      if (!factories.length) throw new Error('No registered DEX factory was found. Deploy one in Contracts, then enter its address here.')
      this.factoryInput = factories[0]
      this.message = 'Factory found. Verify its address before connecting.'
    } catch (error) { this.error = errorMessage(error) }
    finally { this.busy = false }
  }

  async #refreshPools(existingRequest?: number) {
    if (!this.factory || !this.wallet?.selectedAccount || !globalThis.chain) return
    const request = existingRequest ?? ++this.#request
    this.#invalidateQuote()
    if (existingRequest === undefined) this.loading = true
    this.error = ''
    try {
      const pools = await loadDexPools(this.#chain, this.factory, this.wallet.selectedAccount)
      if (request !== this.#request) return
      this.pools = pools
      if (!pools.some(pool => pool.address === this.selectedPoolAddress)) this.selectedPoolAddress = pools[0]?.address || ''
      const pool = this.#pool
      if (pool && this.tokenIn !== pool.token0 && this.tokenIn !== pool.token1) this.tokenIn = pool.token0
      this.#scheduleQuote()
    } catch (error) {
      if (request === this.#request) {
        this.pools = []
        this.error = errorMessage(error)
      }
    } finally {
      if (request === this.#request) this.loading = false
    }
  }

  #selectPool(event: Event) {
    this.selectedPoolAddress = (event.target as HTMLSelectElement).value
    this.tokenIn = this.#pool?.token0 || ''
    this.amountIn = ''
    this.amount0 = ''
    this.amount1 = ''
    this.removeLiquidityAmount = ''
    this.#scheduleQuote()
  }

  #flipTokens() {
    const pool = this.#pool
    if (!pool) return
    this.tokenIn = this.tokenIn === pool.token0 ? pool.token1 : pool.token0
    this.amountIn = ''
    this.#scheduleQuote()
  }

  #invalidateQuote() {
    this.#quoteRequest++
    clearTimeout(this.#quoteTimer)
    clearTimeout(this.#expiryTimer)
    this.quote = undefined
    this.#quoteContext = undefined
    this.reviewing = false
    this.quoting = false
  }

  #scheduleQuote() {
    this.#invalidateQuote()
    this.error = ''
    if (!this.amountIn.trim() || !this.#pool || this.busy) return
    this.quoting = true
    this.#quoteTimer = setTimeout(() => void this.#refreshQuote(), 200)
  }

  #submissionContext() {
    const chain = this.#chain
    const account = this.wallet?.selectedAccount
    const network = getSelectedNetwork().key
    const poolAddress = this.selectedPoolAddress
    const factory = this.factory
    const identity = globalThis.identityController
    const current = () => this.isConnected && chain === this.#chain && account === this.wallet?.selectedAccount &&
      network === getSelectedNetwork().key && poolAddress === this.selectedPoolAddress &&
      factory === this.factory && identity === globalThis.identityController
    return {
      current,
      check: () => {
        if (!current()) throw new Error('Your account, pool or network changed. Review the transaction again.')
        if (!networkStatus(chain, globalThis.peernet).ready) throw new Error('Wait for your node to reconnect and sync.')
      },
      onPending: (method: string, hash: string) => {
        this.transactionHash = hash
        this.message = method === 'approve' ? 'Waiting for token approval…' : 'Waiting for on-chain confirmation…'
      }
    }
  }

  async #refreshQuote() {
    const pool = this.#pool
    if (!pool || this.busy) return
    const request = this.#quoteRequest
    const context = this.#submissionContext()
    this.error = ''
    try {
      const slippage = this.slippage.trim()
      if (!/^\d{1,2}(\.\d{1,2})?$/.test(slippage)) throw new Error('Enter slippage between 0 and 99.99%.')
      const [whole, fraction = ''] = slippage.split('.')
      const quote = await quoteSwap(this.#chain, this.factory, pool, this.tokenIn, this.amountIn, Number(whole) * 100 + Number(fraction.padEnd(2, '0')))
      if (request !== this.#quoteRequest || !context.current()) return
      this.quote = quote
      this.#quoteContext = { current: context.current, deadline: Date.now() + QUOTE_LIFETIME }
      this.#expiryTimer = setTimeout(() => {
        if (this.busy || request !== this.#quoteRequest) return
        this.#invalidateQuote()
        this.error = 'Quote expired. Refresh the quote to continue.'
      }, QUOTE_LIFETIME)
    } catch (error) {
      if (request === this.#quoteRequest && context.current()) this.error = errorMessage(error)
    } finally {
      if (request === this.#quoteRequest) this.quoting = false
    }
  }

  #reviewSwap() {
    if (!this.quote || !this.#quoteContext?.current() || this.busy) return
    if (Date.now() >= this.#quoteContext.deadline) {
      this.#scheduleQuote()
      return
    }
    this.reviewing = true
    void this.updateComplete.then(() => this.shadowRoot?.querySelector<HTMLElement>('.review h2')?.focus())
  }

  async #confirmSwap() {
    const pool = this.#pool, quote = this.quote, account = this.wallet?.selectedAccount
    const reviewed = this.#quoteContext
    if (!pool || !quote || !account || !reviewed || !this.reviewing || this.busy) return
    this.busy = true
    this.error = ''
    this.message = 'Checking allowance…'
    try {
      if (!reviewed.current() || Date.now() >= reviewed.deadline) throw new Error('Review a fresh quote before swapping.')
      const submission = this.#submissionContext()
      this.transactionHash = ''
      const result = await executeSwap({ chain: this.#chain, peernet: globalThis.peernet, identity: globalThis.identityController,
        ...submission, deadline: reviewed.deadline, factory: this.factory, pool, account, tokenIn: quote.input.address,
        amountIn: quote.amountIn, minimumAmountOut: quote.minimumAmountOut })
      this.transactionHash = result.hash
      this.message = 'Swap confirmed'
      this.amountIn = ''
      this.#invalidateQuote()
      if (submission.current()) await this.#refreshPools()
    } catch (error) {
      this.#invalidateQuote()
      this.error = errorMessage(error)
      this.message = ''
    }
    finally { this.busy = false }
  }

  async #addLiquidity() {
    const pool = this.#pool, account = this.wallet?.selectedAccount
    if (!pool || !account || this.busy) return
    this.busy = true
    this.error = ''
    this.message = 'Checking token allowances…'
    try {
      const result = await addDexLiquidity({ chain: this.#chain, peernet: globalThis.peernet,
        ...this.#submissionContext(),
        identity: globalThis.identityController, factory: this.factory, pool, account,
        amount0: this.amount0, amount1: this.amount1 })
      this.message = `Liquidity added · ${shortAddress(result.hash)}`
      this.amount0 = ''; this.amount1 = ''
      await this.#refreshPools()
    } catch (error) { this.error = errorMessage(error); this.message = '' }
    finally { this.busy = false }
  }

  async #removeLiquidity() {
    const pool = this.#pool, account = this.wallet?.selectedAccount
    if (!pool || !account || this.busy) return
    if (!window.confirm(`Remove ${this.removeLiquidityAmount} liquidity units from ${pool.token0Info.symbol}/${pool.token1Info.symbol}?`)) return
    this.busy = true
    this.error = ''
    this.message = 'Removing liquidity…'
    try {
      const result = await removeDexLiquidity({ chain: this.#chain, peernet: globalThis.peernet,
        ...this.#submissionContext(),
        identity: globalThis.identityController, factory: this.factory, pool, account,
        liquidity: this.removeLiquidityAmount })
      this.message = `Liquidity removed · ${shortAddress(result.hash)}`
      this.removeLiquidityAmount = ''
      await this.#refreshPools()
    } catch (error) { this.error = errorMessage(error); this.message = '' }
    finally { this.busy = false }
  }

  #poolSelector() {
    if (!this.pools.length) return html`<div class="empty"><h3>No pools registered</h3><p class="muted">This factory has no trading pools yet.</p></div>`
    return html`<label>Trading pool<select .value=${this.selectedPoolAddress} @change=${this.#selectPool} ?disabled=${this.busy}>
      ${this.pools.map(pool => html`<option value=${pool.address}>${pool.token0Info.symbol} / ${pool.token1Info.symbol}</option>`)}
    </select></label>`
  }

  #overview(pool: DexPool) {
    return html`<div class="pool-overview">
      <div><span class="muted">${pool.token0Info.symbol} reserve</span><strong>${formatTokenAmount(pool.reserve0, pool.token0Info.decimals)}</strong></div>
      <div><span class="muted">${pool.token1Info.symbol} reserve</span><strong>${formatTokenAmount(pool.reserve1, pool.token1Info.decimals)}</strong></div>
      <div><span class="muted">Pool fee</span><strong>${Number(pool.feeBasisPoints) / 100}%</strong></div>
    </div>`
  }

  #trade(pool: DexPool) {
    const input = this.tokenIn === pool.token0 ? pool.token0Info : pool.token1Info
    const output = this.#tokenOut
    const quote = this.quote
    const insufficient = quote && quote.amountIn > input.balance
    const amount = (value: bigint, decimals: number) => formatTokenAmount(value, decimals, decimals)
    return html`<section class="card swap-card">
      ${this.#poolSelector()}
      ${this.reviewing && quote ? html`<div class="review">
        <h2 tabindex="-1">Review swap</h2>
        <div class="quote-row"><span>Pay</span><strong>${amount(quote.amountIn, input.decimals)} ${input.symbol}</strong></div>
        <div class="quote-row"><span>Expected output</span><strong>${amount(quote.amountOut, quote.output.decimals)} ${quote.output.symbol}</strong></div>
        <div class="quote-row"><span>Minimum received</span><strong>${amount(quote.minimumAmountOut, quote.output.decimals)} ${quote.output.symbol}</strong></div>
        <div class="quote-row"><span>Pool fee</span><strong>${Number(pool.feeBasisPoints) / 100}%</strong></div>
        <div class="quote-row"><span>Recipient</span><strong title=${this.wallet?.selectedAccount || ''}>${shortAddress(this.wallet?.selectedAccount)}</strong></div>
        <p class="muted">Your wallet signs the swap and, if needed, an approval for the input amount. Each transaction pays a network fee in LFC.</p>
        <button class="swap-action" @click=${this.#confirmSwap} ?disabled=${this.busy}>${this.busy ? 'Swap in progress…' : 'Confirm swap'}</button>
        <button class="secondary" @click=${() => { this.reviewing = false }} ?disabled=${this.busy}>Edit swap</button>
      </div>` : html`
      <div class="token-box"><div class="token-head"><strong>You pay · ${input.symbol}</strong><span class="muted balance">Balance ${amount(input.balance, input.decimals)}</span></div>
        <input class="amount" aria-label="Swap input amount" inputmode="decimal" autocomplete="off" placeholder="0.0" .value=${this.amountIn}
          ?disabled=${this.busy}
          @input=${(event: InputEvent) => { this.amountIn = (event.target as HTMLInputElement).value; this.#scheduleQuote() }}></div>
      <button class="secondary swap-direction" aria-label="Reverse swap direction" @click=${this.#flipTokens} ?disabled=${this.busy}>⇅</button>
      <div class="token-box"><div class="token-head"><strong>Receive ${output?.symbol}</strong><span class="muted">Estimated</span></div>
        <output class="estimate" aria-live="polite">${quote ? `${amount(quote.amountOut, quote.output.decimals)} ${quote.output.symbol}` : this.quoting ? 'Quoting…' : '—'}</output></div>
      ${quote ? html`<div class="quote-row"><span class="muted">Minimum received</span><strong>${amount(quote.minimumAmountOut, quote.output.decimals)} ${quote.output.symbol}</strong></div>` : ''}
      <details><summary>Slippage tolerance · ${this.slippage}%</summary>
        <label>Maximum slippage (%)<input aria-label="Maximum slippage" inputmode="decimal" .value=${this.slippage} ?disabled=${this.busy}
          @input=${(event: InputEvent) => { this.slippage = (event.target as HTMLInputElement).value; this.#scheduleQuote() }}></label>
      </details>
      ${!quote && !this.quoting && this.amountIn ? html`<button class="secondary" @click=${this.#scheduleQuote}>Refresh quote</button>` : ''}
      <button class="swap-action" @click=${this.#reviewSwap} ?disabled=${this.busy || this.loading || !quote || insufficient}>
        ${this.quoting ? 'Getting quote…' : insufficient ? 'Insufficient balance' : 'Review swap'}
      </button>`}
    </section>`
  }

  #liquidity(pool: DexPool) {
    return html`<section class="card">
      <div class="section-title"><h2>Add liquidity</h2><span class="badge">${pool.token0Info.symbol}/${pool.token1Info.symbol}</span></div>
      <p class="muted">Amounts are matched to the current pool ratio. Unused approved tokens remain in your wallet. Minted liquidity is protected with 0.5% slippage.</p>
      <div class="form-grid">
        <label>${pool.token0Info.symbol} amount<input inputmode="decimal" placeholder="0.0" .value=${this.amount0}
          @input=${(event: InputEvent) => { this.amount0 = (event.target as HTMLInputElement).value }}></label>
        <label>${pool.token1Info.symbol} amount<input inputmode="decimal" placeholder="0.0" .value=${this.amount1}
          @input=${(event: InputEvent) => { this.amount1 = (event.target as HTMLInputElement).value }}></label>
      </div>
      <div class="actions"><button @click=${this.#addLiquidity} ?disabled=${this.busy || !this.amount0 || !this.amount1}>${this.busy ? 'Adding…' : 'Add liquidity'}</button></div>
    </section>
    <section class="card">
      <div class="section-title"><h2>Remove liquidity</h2><span class="badge">Your position: ${pool.liquidity.toString()} units</span></div>
      <p class="muted">Both withdrawal amounts are protected with 0.5% slippage.</p>
      <label>Liquidity units<input inputmode="numeric" placeholder="0" .value=${this.removeLiquidityAmount}
        @input=${(event: InputEvent) => { this.removeLiquidityAmount = (event.target as HTMLInputElement).value }}></label>
      <div class="actions"><button class="secondary" @click=${this.#removeLiquidity}
        ?disabled=${this.busy || !this.removeLiquidityAmount || pool.liquidity === 0n}>${this.busy ? 'Removing…' : 'Remove liquidity'}</button></div>
    </section>`
  }

  render() {
    const pool = this.#pool
    const network = getSelectedNetwork()
    return html`<main>
      <header class="dex-heading"><h1>DEX</h1><span class="muted">${network.label}</span></header>
      ${this.loading ? html`<section class="card loading" role="status">Loading DEX pools…</section>` : ''}
      ${pool && !this.loading ? html`<div class="tabs" role="group" aria-label="DEX actions">
        <button aria-pressed=${this.mode === 'trade'} ?disabled=${this.busy} @click=${() => { this.mode = 'trade'; this.#scheduleQuote() }}>Swap</button>
        <button aria-pressed=${this.mode === 'liquidity'} ?disabled=${this.busy} @click=${() => { this.mode = 'liquidity'; this.#invalidateQuote() }}>Liquidity</button>
      </div>${this.mode === 'trade' ? this.#trade(pool) : html`<section class="card">${this.#poolSelector()}</section>${this.#liquidity(pool)}`}` : ''}
      ${!pool && this.factory && !this.loading ? html`<section class="card">${this.#poolSelector()}</section>` : ''}
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : ''}
      <p class="feedback" role="status">${this.message}
        ${this.transactionHash ? html` <a href=${`#!/explorer/transaction?selected=${encodeURIComponent(this.transactionHash)}`}>View transaction</a>` : ''}
      </p>
      <details class="card details" ?open=${!this.factory && !this.loading}>
        <summary>${pool ? 'Pool and contract details' : 'DEX connection'}</summary>
        <div class="detail-body">
          ${this.factory ? html`<p class="muted">${this.canonicalFactory ? 'Genesis factory' : 'Selected factory'} <code>${this.factory}</code></p>` : ''}
          ${pool ? html`${this.#overview(pool)}<p class="muted">Pool <code>${pool.address}</code></p>
            <p class="muted">${pool.token0Info.symbol} <code>${pool.token0}</code><br>${pool.token1Info.symbol} <code>${pool.token1}</code></p>` : ''}
          ${!this.canonicalFactory ? html`<div class="factory-form">
            <label>Pool factory address<input aria-label="DEX factory address" .value=${this.factoryInput} ?disabled=${this.busy || this.loading}
              @input=${(event: InputEvent) => { this.factoryInput = (event.target as HTMLInputElement).value }}></label>
            <button class="secondary" @click=${this.#discover} ?disabled=${this.busy || this.loading}>Discover</button>
            <button @click=${this.#saveFactory} ?disabled=${this.busy || this.loading || !this.factoryInput.trim()}>Connect</button>
          </div>` : ''}
          <button class="secondary" ?disabled=${this.busy || this.loading} @click=${() => this.factory ? this.#refreshPools() : this.#initialize()}>Refresh pools</button>
        </div>
      </details>
    </main>`
  }
}
