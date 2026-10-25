import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { checkChainPresence, type ChainPresence } from './presence.js'
import { generateGenesisBundle } from './genesis.js'
import {
  GENESIS_PLAN_SCHEMA, GENESIS_RUNTIME, GENESIS_PLAN_MAX_BYTES,
  createGenesisPlan, validateGenesisPlan, parseGenesisPlan, serializeGenesisPlan, fingerprintGenesisPlan,
  type GenesisPlan
} from '@leofcoin/lib/genesis-plan'

@customElement('manager-view')
export class ManagerView extends LitElement {
  @state() accessor step = 0
  @state() accessor label = 'Peach genesis plan'
  @state() accessor owner = ''
  @state() accessor initial = ''
  @state() accessor target = ''
  @state() accessor stars = 'wss://star.leofcoin.org'
  @state() accessor distribute = false
  @state() accessor allocations = [{ address: '', amount: '' }]
  @state() accessor busy = false
  @state() accessor error = ''
  @state() accessor notice = ''
  @state() accessor acknowledged = false
  @state() accessor plan: GenesisPlan | undefined
  @state() accessor fingerprint = ''
  @state() accessor endpoint = ''
  @state() accessor presence: ChainPresence | undefined
  @state() accessor checking = false

  #draft() {
    return {
      schema: GENESIS_PLAN_SCHEMA, version: 1, label: this.label, ...GENESIS_RUNTIME,
      genesisValidator: this.owner, targetSupply: this.target, initialSupply: this.initial,
      allocations: this.distribute ? this.allocations : [{ address: this.owner, amount: this.initial }],
      stars: this.stars.split('\n').map(value => value.trim()).filter(Boolean)
    }
  }
  #change<K extends 'label' | 'owner' | 'initial' | 'target' | 'stars' | 'distribute' | 'allocations'>(name: K, value: this[K]) {
    this[name] = value
    this.error = ''
    this.notice = ''
    this.plan = undefined
    this.fingerprint = ''
    this.acknowledged = false
    this.presence = undefined
  }
  #next = async () => {
    if (this.busy) return
    this.busy = true
    this.error = ''
    try {
      // The first step validates the owner/supply before editing allocations.
      const draft = this.#draft()
      if (this.step === 0) draft.allocations = [{ address: this.owner, amount: this.initial }]
      const plan = await createGenesisPlan(draft)
      if (this.step === 1) {
        this.plan = plan
        this.fingerprint = await fingerprintGenesisPlan(plan)
      }
      this.step++
      this.presence = undefined
      this.notice = ''
    } catch (error) { this.error = error instanceof Error ? error.message : String(error) }
    finally { this.busy = false }
  }
  #editAllocation(index: number, name: 'address' | 'amount', value: string) {
    this.#change('allocations', this.allocations.map((entry, current) => current === index ? { ...entry, [name]: value } : entry))
  }
  #import = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || this.busy) return
    this.busy = true
    this.error = ''
    this.acknowledged = false
    try {
      if (file.size > GENESIS_PLAN_MAX_BYTES) throw new Error('Genesis plan exceeds the 1 MiB size limit')
      const plan = await validateGenesisPlan(parseGenesisPlan(await file.text()))
      this.label = plan.label
      this.owner = plan.genesisValidator
      this.target = plan.targetSupply
      this.initial = plan.initialSupply
      this.stars = plan.stars.join('\n')
      this.distribute = true
      this.allocations = plan.allocations.map(entry => ({ ...entry }))
      this.plan = plan
      this.presence = undefined
      this.fingerprint = await fingerprintGenesisPlan(plan)
      this.acknowledged = false
      this.step = 2
      this.notice = 'Plan imported and validated. No chain state was changed.'
    } catch (error) { this.error = error instanceof Error ? error.message : String(error) }
    finally { this.busy = false }
  }
  #download = () => {
    if (!this.plan || !this.acknowledged || this.busy) return
    const url = URL.createObjectURL(new Blob([serializeGenesisPlan(this.plan)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'leofcoin-genesis-plan.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    this.notice = 'Public plan downloaded. No genesis, account, tokens or chain state were created.'
  }

  #generate = async () => {
    if (!this.plan || !this.acknowledged || this.busy) return
    this.busy = true
    this.error = ''
    try {
      const bundle = await generateGenesisBundle(this.plan)
      const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2) + '\n'], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'leofcoin-genesis-bundle.json'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      this.notice = 'Genesis contract bytecodes generated and verified. The bundle is public; no node was started and no existing chain was changed.'
    } catch (error) { this.error = error instanceof Error ? error.message : String(error) }
    finally { this.busy = false }
  }

  #checkPresence = async () => {
    if (!this.plan || this.checking) return
    this.checking = true
    this.error = ''
    const chainId = this.plan.chainId
    const endpoint = this.endpoint
    try {
      const result = await checkChainPresence(endpoint, chainId)
      if (this.plan?.chainId === chainId && this.endpoint === endpoint) this.presence = result
    } catch (error) {
      if (this.plan?.chainId === chainId && this.endpoint === endpoint) {
        this.presence = { status: 'unknown' }
        this.error = error instanceof Error ? error.message : String(error)
      }
    } finally { this.checking = false }
  }

  static styles = css`
    :host { display:block; height:100%; overflow:auto; box-sizing:border-box; color:var(--md-sys-color-on-surface,#e4edf7); }
    * { box-sizing:border-box; }
    main { max-width:1056px; padding:32px 24px 56px; margin:auto; }
    h1 { font-size:30px; letter-spacing:-.8px; margin:8px 0; } h2 { font-size:20px; margin:0 0 8px; }
    p { line-height:1.6; margin:8px 0 20px; } .muted { color:var(--md-sys-color-on-surface-variant,#aab8ca); }
    .eyebrow { color:var(--md-sys-color-primary,#a3bfff); font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; }
    .intro { display:flex; align-items:center; justify-content:space-between; gap:20px; }
    .badge { white-space:nowrap; border:1px solid var(--md-sys-color-outline-variant,#44556e); padding:6px 12px; border-radius:24px; font-size:12px; }
    ol { display:flex; list-style:none; padding:0; margin:24px 0; gap:12px; }
    li { flex:1; border-bottom:3px solid var(--md-sys-color-outline-variant,#44556e); padding:12px 0; font-weight:600; }
    li[aria-current="step"] { color:var(--md-sys-color-primary,#a3bfff); border-color:var(--md-sys-color-primary,#a3bfff); }
    .grid { display:grid; grid-template-columns:minmax(0,1fr) 256px; gap:24px; }
    .card { background:var(--md-sys-color-surface-container,#182330); border:1px solid var(--md-sys-color-outline-variant,#44556e); border-radius:20px; padding:24px; }
    aside { align-self:start; } aside p { font-size:13px; } aside h2 { font-size:15px; }
    fieldset { border:0; padding:0; margin:0; min-width:0; }
    label { display:block; font-size:13px; font-weight:600; margin:20px 0 8px; }
    input:not([type="checkbox"]),textarea { width:100%; border:1px solid var(--md-sys-color-outline,#62718a); border-radius:10px; background:var(--md-sys-color-surface,#10161f); color:inherit; padding:12px; font:inherit; }
    textarea { resize:vertical; min-height:90px; } input:focus-visible, textarea:focus-visible,button:focus-visible { outline:2px solid var(--md-sys-color-primary,#a3bfff); outline-offset:3px; }
    .row { display:flex; gap:12px; align-items:center; } .row > div { flex:1; min-width:0; }
    .hint { display:block; font-size:12px; margin-top:7px; line-height:1.5; color:var(--md-sys-color-on-surface-variant,#aab8ca); }
    .check { display:flex; gap:10px; align-items:flex-start; line-height:1.5; } .check input { margin-top:3px; }
    button,.import { cursor:pointer; border-radius:24px; border:1px solid var(--md-sys-color-outline,#62718a); background:transparent; color:inherit; font:inherit; padding:11px 18px; font-weight:600; }
    button:disabled { opacity:.45; cursor:not-allowed; } .primary { background:var(--lfc-action,#1d64d8); color:var(--lfc-on-action,#ffffff); border-color:transparent; }
    .small { padding:7px 12px; font-size:12px; } .actions { display:flex; gap:12px; justify-content:space-between; margin-top:28px; flex-wrap:wrap; }
    .allocation { border-top:1px solid var(--md-sys-color-outline-variant,#44556e); margin-top:20px; padding-top:4px; }
    .allocation .amount { max-width:170px; } .alert { border:1px solid var(--md-sys-color-error,#ffb4ab); border-radius:12px; padding:14px; margin:20px 0; overflow-wrap:anywhere; }
    .notice { color:var(--md-sys-color-primary,#a3bfff); } dl { margin:20px 0; } dt { color:var(--md-sys-color-on-surface-variant,#aab8ca); font-size:12px; margin-top:16px; } dd { margin:4px 0 0; overflow-wrap:anywhere; }
    code { font-size:12px; overflow-wrap:anywhere; } .fingerprint { border-radius:12px; padding:16px; background:var(--md-sys-color-surface,#10161f); margin-top:20px; }
    details { margin-top:18px; } summary { cursor:pointer; font-size:13px; } pre { white-space:pre-wrap; overflow-wrap:anywhere; font-size:11px; line-height:1.6; max-height:280px; overflow:auto; }
    .import { display:inline-block; margin:0; } .import:focus-within { outline:2px solid var(--md-sys-color-primary,#a3bfff); }
    .import input { position:absolute; width:1px; height:1px; opacity:0; }
    @media(max-width:760px) { main { padding:20px 16px 40px; } .grid { grid-template-columns:1fr; } aside { order:2; } .intro { align-items:flex-start; flex-direction:column; gap:8px; } .card { padding:20px; } ol { gap:8px; font-size:12px; } }
    @media(max-width:420px) { .row { flex-wrap:wrap; } .allocation .amount { max-width:none; } .row>div { flex-basis:100%; } }
  `

  render() {
    return html`<main>
      <div class="intro"><div><span class="eyebrow">Chain manager</span><h1>Plan your genesis.</h1>
        <p class="muted">Define the starting point. Review every allocation. Keep control of your keys.</p></div>
        <span class="badge">Offline genesis studio · no chain changes</span></div>
      <ol aria-label="Setup progress">${['Runtime & supply','Initial distribution','Review & export'].map((title,index) =>
        html`<li aria-current=${this.step === index ? 'step' : 'false'}>${index + 1}. ${title}</li>`)}</ol>
      ${this.error ? html`<div class="alert" role="alert">${this.error}</div>` : ''}
      ${this.notice ? html`<p class="notice" role="status">${this.notice}</p>` : ''}
      <div class="grid"><section class="card" aria-busy=${this.busy}>
        <fieldset ?disabled=${this.busy}>
        ${this.step === 0 ? html`
          <h2>Runtime & supply</h2><p class="muted">This runtime uses Peach, LFC and protocol ${GENESIS_RUNTIME.protocolVersion}. Supply values are your choice; there is no prefilled cap.</p>
          <label for="label">Plan label</label><input id="label" maxlength="80" .value=${this.label} @input=${(event: Event) => this.#change('label',(event.target as HTMLInputElement).value)}>
          <label for="owner">Genesis validator · public address</label><input id="owner" spellcheck="false" autocomplete="off" .value=${this.owner} @input=${(event: Event) => this.#change('owner',(event.target as HTMLInputElement).value)}>
          <span class="hint">Use an account you control. Never paste a mnemonic, private key or password.</span>
          <div class="row"><div><label for="initial">Initial supply · LFC</label><input id="initial" inputmode="decimal" placeholder="Choose an amount" .value=${this.initial} @input=${(event: Event) => this.#change('initial',(event.target as HTMLInputElement).value)}></div>
            <div><label for="target">Target supply · LFC</label><input id="target" inputmode="decimal" placeholder="Choose a target" .value=${this.target} @input=${(event: Event) => this.#change('target',(event.target as HTMLInputElement).value)}></div></div>
          <span class="hint">The target guides monetary policy; it is not a hard maximum supply. Initial supply must not exceed it. Up to 18 decimals.</span>
          <label for="stars">Discovery stars · one wss:// URL per line</label><textarea id="stars" spellcheck="false" .value=${this.stars} @input=${(event: Event) => this.#change('stars',(event.target as HTMLTextAreaElement).value)}></textarea>
          <span class="hint">Leave empty for an offline plan. A discovery endpoint does not guarantee a running validator.</span>
        ` : this.step === 1 ? html`
          <h2>Initial distribution</h2><p class="muted">Allocate exactly ${this.initial} LFC. No extra tokens are minted by this planner.</p>
          <label class="check"><input type="checkbox" .checked=${this.distribute} @change=${(event: Event) => this.#change('distribute',(event.target as HTMLInputElement).checked)}>Split the supply between multiple public accounts</label>
          ${this.distribute ? html`${this.allocations.map((entry,index) => html`<div class="allocation">
            <div class="row"><div><label for=${`address-${index}`}>Account ${index + 1}</label><input id=${`address-${index}`} spellcheck="false" autocomplete="off" .value=${entry.address} @input=${(event: Event) => this.#editAllocation(index,'address',(event.target as HTMLInputElement).value)}></div>
              <div class="amount"><label for=${`amount-${index}`}>Amount · LFC</label><input id=${`amount-${index}`} inputmode="decimal" .value=${entry.amount} @input=${(event: Event) => this.#editAllocation(index,'amount',(event.target as HTMLInputElement).value)}></div></div>
            <button type="button" class="small" aria-label=${`Remove allocation ${index + 1}`} ?disabled=${this.allocations.length === 1} @click=${() => this.#change('allocations',this.allocations.filter((_,current) => current !== index))}>Remove allocation</button></div>`)}
            <div class="actions"><button type="button" ?disabled=${this.allocations.length >= 1000} @click=${() => this.#change('allocations',[...this.allocations,{address:'',amount:''}])}>Add account</button>
            <button type="button" @click=${() => this.#change('allocations',[{address:this.owner,amount:this.initial}])}>Allocate all to validator</button></div>`
            : html`<dl><dt>Genesis validator receives</dt><dd>${this.initial} LFC</dd><dt>Public address</dt><dd><code>${this.owner}</code></dd></dl>`}
          <p class="hint">The genesis validator must receive an allocation. Other validators join through the normal on-chain registration process.</p>
        ` : this.plan ? html`
          <h2>Review the public plan</h2><p class="muted">Download the public plan, or generate its verified genesis contract bundle. Neither starts validators, resets stores or changes an existing chain.</p>
          <dl><dt>Chain ID · genesis identity</dt><dd><code>${this.plan.chainId}</code></dd>
            <dt>Plan / runtime</dt><dd>${this.plan.label} · ${this.plan.network} · ${this.plan.token.symbol}</dd>
            <dt>Initial supply → policy target</dt><dd>${this.plan.initialSupply} → ${this.plan.targetSupply} LFC</dd>
            <dt>Genesis validator</dt><dd><code>${this.plan.genesisValidator}</code></dd>
            <dt>Initial allocations (${this.plan.allocations.length})</dt>${this.plan.allocations.map(entry => html`<dd><code>${entry.address}</code><br>${entry.amount} LFC</dd>`)}
            <dt>Discovery stars</dt><dd>${this.plan.stars.length ? this.plan.stars.join(', ') : 'None · offline plan'}</dd></dl>
          <div class="fingerprint"><strong>Already announced?</strong>
            <p class="hint">The ID identifies the same genesis even if its label or discovery stars change. Editing genesis values produces a different ID.</p>
            <label for="endpoint">Node HTTP endpoint · optional</label>
            <input id="endpoint" type="url" placeholder="http://127.0.0.1:3030" .value=${this.endpoint}
              @input=${(event: Event) => { this.endpoint = (event.target as HTMLInputElement).value; this.presence = undefined; this.error = '' }}>
            <button type="button" class="small" ?disabled=${this.checking} @click=${this.#checkPresence}>${this.checking ? 'Checking…' : 'Check node identity'}</button>
            ${this.presence ? html`<p role="status">${this.presence.status === 'found'
              ? 'Matching genesis identity reported by this endpoint.'
              : this.presence.status === 'not-observed' ? 'This endpoint reports a different chain. This does not mean the chain is available to claim.'
              : 'Unknown: no endpoint configured or no valid response.'}</p>` : ''}
            <p class="hint">Read-only request to /chainIdentity with a three-second timeout. Only this endpoint is checked, not its peers. It must allow cross-origin requests; HTTPS pages require HTTPS endpoints. This does not reserve an ID, verify finality or prove worldwide nonexistence. Planning stays offline.</p></div>
          <div class="fingerprint"><strong>Configuration fingerprint · SHA-256</strong><p><code>${this.fingerprint}</code></p><span class="hint">Identifies this exact public plan, not a genesis block or a live network.</span></div>
          <details><summary>Inspect exported JSON</summary><pre>${serializeGenesisPlan(this.plan)}</pre></details>
          <label class="check"><input type="checkbox" .checked=${this.acknowledged} @change=${(event: Event) => this.acknowledged = (event.target as HTMLInputElement).checked}>I reviewed the allocations and understand this export contains only public configuration.</label>
          <p class="hint">Validate locally without opening a node:<br><code>npm run genesis:validate -- ./leofcoin-genesis-plan.json</code></p>
          <button type="button" ?disabled=${!this.acknowledged || this.busy} @click=${this.#generate}>Generate genesis bundle</button>
        ` : ''}
        <div class="actions"><div>${this.step ? html`<button type="button" @click=${() => { this.step--; this.error = ''; this.notice = ''; this.acknowledged = false }}>Back</button>` : html`<label class="import">Import plan<input type="file" accept=".json,application/json" aria-label="Import public genesis plan" @change=${this.#import}></label>`}</div>
          ${this.step < 2 ? html`<button class="primary" type="button" @click=${this.#next}>${this.busy ? 'Validating…' : this.step === 0 ? 'Continue' : 'Review plan'}</button>` : html`<button class="primary" type="button" ?disabled=${!this.acknowledged} @click=${this.#download}>Download public plan</button>`}</div>
        </fieldset></section>
        <aside class="card"><h2>A safe starting point</h2><p class="muted">This wizard works offline, without unlocking a wallet. Your draft stays in memory until you download it.</p>
          <h2>Keys stay with you</h2><p class="muted">Only public addresses belong in this plan. Private credentials are created and backed up separately by the operator.</p>
          <h2>Runtime boundaries</h2><p class="muted">Token details, consensus timing and fee rules are fixed by the reviewed runtime. Changing a form must never silently change consensus.</p>
          <h2>Not a recovery tool</h2><p class="muted">Existing chains require verified replay and a backup. There are deliberately no reset or balance-edit buttons here.</p></aside>
      </div></main>`
  }
}
