import { css, html, LitElement } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { getSelectedNetwork } from '../network-selection.js'
import { errorMessage } from '../controllers/transfer.js'
import {
  addDexLiquidity,
  discoverDexFactories,
  executeSwap,
  formatTokenAmount,
  loadDexPools,
  quoteSwap,
  removeDexLiquidity,
  validateFactory,
  type ChainLike,
  type DexPool
} from '../controllers/dex-trading.js'
import { viewHeader, viewPolish } from './view-polish.js'

type Wallet = { selectedAccount?: string }
type SwapQuote = Awaited<ReturnType<typeof quoteSwap>>

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
  @state() accessor amount0 = ''
  @state() accessor amount1 = ''
  @state() accessor removeLiquidityAmount = ''
  @state() accessor mode: 'trade' | 'liquidity' = 'trade'
  @state() accessor loading = true
  @state() accessor busy = false
  @state() accessor error = ''
  @state() accessor message = ''
  #request = 0

  get #chain(): ChainLike { return globalThis.chain as unknown as ChainLike }

  static styles = [viewPolish, css`
    .tabs { display: flex; gap: 6px; padding: 5px; border: 1px solid var(--lfc-glass-border, #51474e);
      border-radius: 16px; background: var(--lfc-glass-surface, #242126); }
    .tabs button { flex: 1; background: transparent; color: inherit; }
    .tabs button[aria-selected='true'] { background: var(--lfc-action, #1d64d8); color: var(--lfc-on-action, #fff); }
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
    .status-line { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #65d48a; }
    .danger-note { border-left: 3px solid var(--md-sys-color-error, #ffb4ab); }
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
    super.disconnectedCallback()
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('wallet') && changed.get('wallet') !== undefined) void this.#refreshPools()
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
      const saved = localStorage.getItem(this.#storageKey) || ''
      let factory = saved
      if (factory) {
        try { await validateFactory(chain, factory) }
        catch { factory = '' }
      }
      if (!factory) factory = (await discoverDexFactories(chain))[0] || ''
      if (request !== this.#request) return
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
    if (this.busy) return
    this.busy = true
    this.error = ''
    this.message = ''
    try {
      await validateFactory(this.#chain, this.factoryInput)
      this.factory = this.factoryInput.trim()
      localStorage.setItem(this.#storageKey, this.factory)
      await this.#refreshPools()
      this.message = 'DEX factory connected.'
    } catch (error) { this.error = errorMessage(error) }
    finally { this.busy = false }
  }

  async #discover() {
    if (this.busy) return
    this.busy = true
    this.error = ''
    this.message = ''
    try {
      const factories = await discoverDexFactories(this.#chain)
      if (!factories.length) throw new Error('No registered DEX factory was found. Deploy one in Contracts, then enter its address here.')
      this.factoryInput = factories[0]
      await validateFactory(this.#chain, this.factoryInput)
      this.factory = this.factoryInput
      localStorage.setItem(this.#storageKey, this.factory)
      await this.#refreshPools()
      this.message = 'DEX factory discovered and connected.'
    } catch (error) { this.error = errorMessage(error) }
    finally { this.busy = false }
  }

  async #refreshPools(existingRequest?: number) {
    if (!this.factory || !this.wallet?.selectedAccount || !globalThis.chain) return
    const request = existingRequest ?? ++this.#request
    if (existingRequest === undefined) this.loading = true
    this.error = ''
    try {
      const pools = await loadDexPools(this.#chain, this.factory, this.wallet.selectedAccount)
      if (request !== this.#request) return
      this.pools = pools
      if (!pools.some(pool => pool.address === this.selectedPoolAddress)) this.selectedPoolAddress = pools[0]?.address || ''
      const pool = this.#pool
      if (pool && this.tokenIn !== pool.token0 && this.tokenIn !== pool.token1) this.tokenIn = pool.token0
      this.quote = undefined
    } catch (error) {
      if (request === this.#request) this.error = errorMessage(error)
    } finally {
      if (request === this.#request) this.loading = false
    }
  }

  #selectPool(event: Event) {
    this.selectedPoolAddress = (event.target as HTMLSelectElement).value
    this.tokenIn = this.#pool?.token0 || ''
    this.quote = undefined
    this.amountIn = ''
  }

  #flipTokens() {
    const pool = this.#pool
    if (!pool) return
    this.tokenIn = this.tokenIn === pool.token0 ? pool.token1 : pool.token0
    this.quote = undefined
  }

  async #reviewSwap() {
    const pool = this.#pool
    if (!pool || this.busy) return
    this.busy = true
    this.error = ''
    this.message = ''
    try {
      const percent = Number(this.slippage)
      if (!Number.isFinite(percent) || percent < 0 || percent >= 100) throw new Error('Enter slippage between 0 and 99.99%.')
      this.quote = await quoteSwap(this.#chain, this.factory, pool, this.tokenIn, this.amountIn, Math.round(percent * 100))
    } catch (error) { this.error = errorMessage(error); this.quote = undefined }
    finally { this.busy = false }
  }

  async #confirmSwap() {
    const pool = this.#pool, quote = this.quote, account = this.wallet?.selectedAccount
    if (!pool || !quote || !account || this.busy) return
    this.busy = true
    this.error = ''
    this.message = 'Checking allowance…'
    try {
      const chain = this.#chain
      const result = await executeSwap({ chain, peernet: globalThis.peernet, identity: globalThis.identityController,
        factory: this.factory, pool, account, tokenIn: this.tokenIn,
        amountIn: quote.amountIn, minimumAmountOut: quote.minimumAmountOut })
      if (globalThis.chain as unknown !== chain as unknown || this.wallet?.selectedAccount !== account) throw new Error('The active account or network changed during the swap.')
      this.message = `Swap confirmed · ${shortAddress(result.hash)}`
      this.amountIn = ''
      this.quote = undefined
      await this.#refreshPools()
    } catch (error) { this.error = errorMessage(error); this.message = '' }
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
    return html`<section class="card">
      <div class="section-title"><h2>Swap tokens</h2><span class="badge">Wallet signed</span></div>
      <div class="token-box"><div class="token-head"><strong>Pay ${input.symbol}</strong><span class="muted balance">Balance ${formatTokenAmount(input.balance, input.decimals)}</span></div>
        <input aria-label="Swap input amount" inputmode="decimal" placeholder="0.0" .value=${this.amountIn}
          @input=${(event: InputEvent) => { this.amountIn = (event.target as HTMLInputElement).value; this.quote = undefined }}></div>
      <button class="secondary swap-direction" aria-label="Reverse swap direction" @click=${this.#flipTokens} ?disabled=${this.busy}>⇅</button>
      <div class="token-box"><div class="token-head"><strong>Receive ${output?.symbol}</strong><span class="muted">Estimated</span></div>
        <strong>${this.quote ? formatTokenAmount(this.quote.amountOut, this.quote.output.decimals) : '—'}</strong></div>
      <label>Maximum slippage (%)<input aria-label="Maximum slippage" inputmode="decimal" .value=${this.slippage}
        @input=${(event: InputEvent) => { this.slippage = (event.target as HTMLInputElement).value; this.quote = undefined }}></label>
      ${this.quote ? html`<div class="review" role="status">
        <div class="quote-row"><span class="muted">Expected output</span><strong>${formatTokenAmount(this.quote.amountOut, this.quote.output.decimals)} ${this.quote.output.symbol}</strong></div>
        <div class="quote-row"><span class="muted">Minimum received</span><strong>${formatTokenAmount(this.quote.minimumAmountOut, this.quote.output.decimals)} ${this.quote.output.symbol}</strong></div>
        <p class="muted">An approval transaction is submitted first only when the current allowance is insufficient.</p>
        <button @click=${this.#confirmSwap} ?disabled=${this.busy}>${this.busy ? 'Confirming…' : 'Confirm swap'}</button>
      </div>` : html`<div class="actions"><button @click=${this.#reviewSwap} ?disabled=${this.busy || !this.amountIn}>${this.busy ? 'Getting quote…' : 'Review swap'}</button></div>`}
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
    return html`<main>
      ${viewHeader('accounts', 'LEOFCOIN DEX', 'Trade from your own node', 'Swap tokens and manage liquidity without sending your keys to an exchange or remote server.')}
      <section class="card">
        <div class="section-title"><h2>DEX connection</h2>${this.factory ? html`<span class="badge"><span class="status-dot"></span>Connected</span>` : ''}</div>
        <div class="factory-form"><label>Pool factory address<input aria-label="DEX factory address" .value=${this.factoryInput}
          @input=${(event: InputEvent) => { this.factoryInput = (event.target as HTMLInputElement).value }}></label>
          <button class="secondary" @click=${this.#discover} ?disabled=${this.busy}>Discover</button>
          <button @click=${this.#saveFactory} ?disabled=${this.busy || !this.factoryInput}>Connect</button></div>
        ${this.factory ? html`<p class="muted">Factory ${shortAddress(this.factory)} · ${this.pools.length} pool${this.pools.length === 1 ? '' : 's'}</p>` : html`<p class="muted">No canonical factory is configured in genesis yet. Discover a registered factory or paste its contract address.</p>`}
      </section>
      ${this.loading ? html`<section class="card loading" role="status">Loading DEX pools…</section>` : ''}
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : ''}
      <p class="feedback" role="status">${this.message}</p>
      ${this.factory && !this.loading ? html`<section class="card">${this.#poolSelector()}${pool ? this.#overview(pool) : ''}</section>` : ''}
      ${pool ? html`<nav class="tabs" aria-label="DEX actions">
        <button aria-selected=${this.mode === 'trade'} @click=${() => { this.mode = 'trade' }}>Trade</button>
        <button aria-selected=${this.mode === 'liquidity'} @click=${() => { this.mode = 'liquidity' }}>Liquidity</button>
      </nav>${this.mode === 'trade' ? this.#trade(pool) : this.#liquidity(pool)}` : ''}
      <section class="card danger-note"><h2>On-chain risk</h2><p class="muted">Quotes can change before confirmation. Verify the factory and token contracts yourself. Pool positions in this MVP are non-transferable, and smart-contract losses cannot be reversed.</p></section>
    </main>`
  }
}
