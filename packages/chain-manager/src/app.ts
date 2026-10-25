import { LitElement, html, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { OperatorController } from './operator.js'
import { FAUCET_SOURCE } from './templates.js'
import { appStyles } from './app-styles.js'
import './manager.js'

const pages = ['overview', 'chains', 'wallet', 'contracts', 'faucet', 'activity', 'genesis'] as const
type Page = typeof pages[number]
type Review = NonNullable<OperatorController['prepared']>

/** Downloads only the controller's encrypted backup; no plaintext wallet material. */
function downloadBackup(backup: string): void {
  const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `chain-manager-wallet-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(link)
  try { link.click() }
  finally {
    link.remove()
    // Delay revocation so file:// / Electron downloads can consume the URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

@customElement('chain-manager-app')
export class ChainManagerApp extends LitElement {
  static styles = appStyles
  private readonly controller = new OperatorController()
  @state() accessor page: Page = 'overview'
  @state() accessor localError = ''
  @state() accessor localNotice = ''
  @state() accessor running = false
  @state() accessor acknowledged = false
  @state() accessor sourceAcknowledged = false
  @state() accessor source = ''
  @state() accessor constructorParams = '[]'
  @state() accessor staticResult: string | undefined
  @state() accessor deploymentSource: { id: string; source: string; params: string } | undefined
  private reviewId: string | undefined
  private fileReadId = 0
  private get busy(): boolean { return this.running || this.controller.busy }
  private get canSign(): boolean {
    return !!this.controller.active && this.controller.walletUnlocked && !this.busy && !this.controller.prepared
  }
  private readonly onChange = (): void => {
    const id = this.controller.prepared?.id
    const newReview = !!id && id !== this.reviewId
    if (id !== this.reviewId) {
      this.reviewId = id
      this.acknowledged = false
      this.sourceAcknowledged = false
      if (this.deploymentSource?.id !== id) this.deploymentSource = undefined
    }
    this.requestUpdate()
    if (newReview) void this.updateComplete.then(() => {
      this.renderRoot.querySelector<HTMLElement>('#review-heading')?.focus()
    })
  }
  override connectedCallback(): void {
    super.connectedCallback()
    this.controller.addEventListener('change', this.onChange)
    this.onChange()
  }
  override disconnectedCallback(): void {
    this.controller.removeEventListener('change', this.onChange)
    this.fileReadId++
    this.resetSetup()
    this.lockSession()
    super.disconnectedCallback()
  }
  private resetSetup(): void {
    this.source = ''
    this.constructorParams = '[]'
    this.staticResult = undefined
    this.deploymentSource = undefined
    this.acknowledged = false
    this.sourceAcknowledged = false
    this.renderRoot.querySelectorAll<HTMLFormElement>('form').forEach(form => form.reset())
  }
  private lockSession(): void {
    // Cleanup must not depend on the busy guard used for user actions.
    try { this.controller.cancelPrepared() }
    catch (error: unknown) { this.localError = error instanceof Error ? error.message : String(error) }
    try { this.controller.lockWallet() }
    catch (error: unknown) { this.localError = error instanceof Error ? error.message : String(error) }
  }
  private async run(action: () => unknown | Promise<unknown>): Promise<void> {
    if (this.busy) return
    this.running = true
    this.localError = ''
    this.localNotice = ''
    try { await action() }
    catch (error: unknown) { this.localError = error instanceof Error ? error.message : String(error) }
    finally {
      // An in-flight unlock/import may finish after the element was removed.
      if (!this.isConnected) this.lockSession()
      this.running = false
      this.onChange()
    }
  }
  private navigate(page: Page): void {
    this.page = page
    this.staticResult = undefined
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('#page-heading')?.focus())
  }
  private data(event: SubmitEvent): FormData {
    event.preventDefault()
    return new FormData(event.currentTarget as HTMLFormElement)
  }
  private text(data: FormData, key: string): string { return String(data.get(key) ?? '').trim() }
  private clearPasswords(event: SubmitEvent): void {
    const form = event.currentTarget as HTMLFormElement
    form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input => { input.value = '' })
  }
  private readonly discover = (event: SubmitEvent): void => {
    const data = this.data(event)
    const form = event.currentTarget as HTMLFormElement
    void this.run(async () => {
      await this.controller.discoverProfile(this.text(data, 'name'), this.text(data, 'endpoint'), data.get('testnet') === 'on')
      form.reset()
      await this.controller.refresh()
    })
  }
  private walletAction(event: SubmitEvent, mode: 'create' | 'unlock' | 'import'): void {
    const data = this.data(event)
    const password = String(data.get('password') ?? '')
    this.clearPasswords(event)
    const form = event.currentTarget as HTMLFormElement
    void this.run(async () => {
      if (mode !== 'unlock' && this.controller.walletExists) {
        throw new Error('A wallet already exists. Replacement is refused; recovery import requires a fresh application instance with no saved wallet.')
      }
      if (mode === 'create') {
        if (password.length < 12) throw new Error('Use a password with at least 12 characters.')
        const backup = await this.controller.createWallet(password)
        downloadBackup(backup)
        this.localNotice = 'Encrypted backup download requested. Store it safely and verify it before funding this wallet. Your password is required to restore it.'
      } else if (mode === 'unlock') {
        await this.controller.unlockWallet(password)
      } else {
        const file = data.get('backup')
        if (!(file instanceof File) || !file.size) throw new Error('Choose an encrypted wallet backup.')
        if (file.size > 1024 * 1024) throw new Error('Wallet backups must be 1 MiB or smaller.')
        const readId = ++this.fileReadId
        const backup = await file.text()
        if (readId !== this.fileReadId || !this.isConnected) throw new Error('Import cancelled. Please try again.')
        await this.controller.importWallet(password, backup)
      }
      form.reset()
    })
  }
  private readonly call = (event: SubmitEvent): void => {
    const data = this.data(event)
    void this.run(() => this.controller.prepareCall(this.text(data, 'contract'), this.text(data, 'method'), this.text(data, 'params')))
  }
  private readonly read = (event: SubmitEvent): void => {
    const data = this.data(event)
    this.staticResult = undefined
    const profileId = this.controller.activeId
    void this.run(async () => {
      const result = await this.controller.staticCall(this.text(data, 'contract'), this.text(data, 'method'), this.text(data, 'params'))
      if (profileId === this.controller.activeId) this.staticResult = JSON.stringify(result, null, 2) ?? String(result)
    })
  }
  private readonly deploy = (event: SubmitEvent): void => {
    const data = this.data(event)
    const source = String(data.get('source') ?? '')
    const params = this.text(data, 'params')
    void this.run(async () => {
      await this.controller.prepareDeploy(source, params)
      const prepared = this.controller.prepared
      if (prepared?.kind === 'deploy' && this.isConnected) {
        this.deploymentSource = { id: prepared.id, source, params }
      }
    })
  }
  private readonly fund = (event: SubmitEvent): void => {
    const data = this.data(event)
    void this.run(() => this.controller.prepareFunding(this.text(data, 'recipient'), this.text(data, 'amount')))
  }
  private readonly mint = (event: SubmitEvent): void => {
    const data = this.data(event)
    void this.run(() => this.controller.prepareMint(this.text(data, 'token'), this.text(data, 'recipient'), this.text(data, 'amount')))
  }
  private readonly configureFaucet = (event: SubmitEvent): void => {
    const data = this.data(event)
    void this.run(() => this.controller.configureFaucet(
      this.text(data, 'claim'), Number(this.text(data, 'cooldown')) * 1000,
      this.text(data, 'budget'), this.text(data, 'funding')
    ))
  }
  private prepareFaucet(): void {
    void this.run(async () => {
      await this.controller.prepareFaucetStep()
      const review = this.controller.prepared
      const setup = this.controller.faucetSetup
      if (review?.kind === 'deploy' && setup)
        this.deploymentSource = { id: review.id, source: FAUCET_SOURCE, params: this.controller.faucetConstructor(setup) }
    })
  }
  private row(label: string, value: unknown) {
    return html`<div><dt>${label}</dt><dd class="mono">${String(value ?? 'Not available')}</dd></div>`
  }
  private intro(title: string, description: string) {
    return html`<header class="intro"><p class="eyebrow">Operator workspace / ${this.page}</p>
      <h1 id="page-heading" tabindex="-1">${title}</h1><p class="muted">${description}</p></header>`
  }
  private empty(title: string, description: string, page?: Page, action?: string) {
    return html`<div class="empty"><h2>${title}</h2><p class="muted">${description}</p>
      ${page ? html`<button @click=${() => this.navigate(page)}>${action}</button>` : nothing}</div>`
  }
  private signingHint() {
    const c = this.controller
    if (!c.active) return html`<p class="banner warning">Add and select a verified chain before preparing a transaction.</p>`
    if (!c.walletUnlocked) return html`<p class="banner warning">Unlock your wallet in the Wallet tab to prepare a transaction. Preparation signs locally to quote exact serialized fees; broadcasting requires your explicit consent.</p>`
    if (c.prepared) return html`<p class="banner warning">Review or cancel the prepared transaction above before preparing another.</p>`
    return nothing
  }
  private overview() {
    const c = this.controller
    const s = c.status
    return html`${this.intro('Your chains. Under control.', 'Connect to a node, manage an encrypted wallet, and review every transaction before it leaves your device.')}
      ${!c.active ? this.empty('Start with a verified connection', 'Add an HTTP endpoint. Its chain identity is checked before the profile is saved.', 'chains', 'Connect a chain') : html`
        <div class="metrics">
          <section class="panel"><p class="eyebrow">Block height</p><p class="metric">${s?.height ?? '—'}</p><p class="help">${s ? 'Last node response' : 'Refresh to request node status'}</p></section>
          <section class="panel"><p class="eyebrow">Connected peers</p><p class="metric">${s?.peers ?? '—'}</p><p class="help">${s ? (s.synced ? 'Node reports synchronized' : 'Node reports not synchronized') : 'Status not yet available'}</p></section>
          <section class="panel"><p class="eyebrow">Wallet balance · LFC</p><p class="metric">${c.walletAddress && s ? s.balance : '—'}</p><p class="help">${c.walletAddress ? 'Last reported balance; refresh to update' : 'Unlock a wallet to view its balance'}</p></section>
        </div>
        <div class="grid">
          <section class="panel"><h2>Active connection</h2><p class="help">Identity from your verified profile. Status updates are requested explicitly.</p>
            <dl>${this.row('Chain ID', c.active.chainId)}${this.row('Endpoint', c.active.endpoint)}${this.row('Network', c.active.network)}
              ${this.row('Native token', s?.nativeToken)}${this.row('Contract factory', s?.contractFactory)}</dl>
            <div class="actions"><button @click=${() => this.navigate('chains')}>Manage connections</button></div>
          </section>
          <section class="panel"><h2>Broadcasting stays intentional</h2><p class="muted">Preparation signs locally to quote exact serialized fees. The signature stays in memory. Inspect the complete transaction, then explicitly authorize broadcasting.</p>
            <dl>${this.row('Wallet', c.walletUnlocked ? 'Unlocked · in memory' : c.walletExists ? 'Encrypted · locked' : 'Not created')}
              ${this.row('Address', c.walletAddress || 'Unlock to view')}${this.row('Nonce', c.walletAddress ? s?.nonce : undefined)}</dl>
            <button @click=${() => this.navigate('wallet')}>Manage wallet</button>
          </section>
        </div>`}
      <section class="panel" style="margin-top:20px"><h2>A deliberate workflow</h2><p class="muted">01 Connect & verify. &nbsp; 02 Back up your wallet. &nbsp; 03 Prepare & review. &nbsp; 04 Track confirmation.</p>
        <p class="help">Open Genesis to generate verified public genesis bundles. Bundle generation is separate from operating a live chain and does not start nodes.</p></section>`
  }
  private chains() {
    const c = this.controller
    return html`${this.intro('Know your connection.', 'Profiles are added only after the endpoint reports its chain identity. Switching chains locks the wallet; unlock it again deliberately.')}
      <div class="grid">
        <section class="panel"><h2>Saved chains</h2>
          ${!c.profiles.length ? html`<p class="muted">No saved profiles yet. Connect your first node using the form.</p>` : c.profiles.map(profile => html`
            <article class="profile"><div class="section-head"><h3>${profile.name}</h3><span class="badge ${profile.testnet ? 'warn' : 'neutral'}">${profile.testnet ? 'Testnet' : 'Live network'}</span></div>
              <dl>${this.row('Chain ID', profile.chainId)}${this.row('Endpoint', profile.endpoint)}${this.row('Network', profile.network)}</dl>
              <div class="actions"><button ?disabled=${this.busy || profile.id === c.activeId} @click=${() => void this.run(async () => {
                c.cancelPrepared(); c.selectProfile(profile.id); this.resetSetup()
                await c.refresh()
              })}>${profile.id === c.activeId ? 'Selected' : 'Select & lock wallet'}</button>
                <button class="quiet danger" ?disabled=${this.busy} @click=${() => {
                  if (window.confirm(`Remove "${profile.name}"? This removes only the saved connection, not chain data.`)) void this.run(async () => {
                    const wasActive = profile.id === c.activeId
                    c.removeProfile(profile.id)
                    if (wasActive) {
                      this.resetSetup()
                      if (c.active) await c.refresh()
                    }
                  })
                }}>Remove</button></div>
            </article>`)}
        </section>
        <section class="panel"><h2>Add a connection</h2><p class="muted">Use a trusted HTTP API endpoint. The testnet designation must agree with the node.</p>
          <form @submit=${this.discover}><fieldset ?disabled=${this.busy}>
            <label>Profile name<input name="name" required maxlength="80" placeholder="Local development"></label>
            <label>HTTP API endpoint<input name="endpoint" type="url" required spellcheck="false" placeholder="http://localhost:3000" aria-describedby="endpoint-help"></label>
            <p class="help" id="endpoint-help">Use HTTPS for remote nodes. A browser served over HTTPS may block local HTTP connections; use the standalone desktop app or a secure endpoint.</p>
            <label class="check"><input type="checkbox" name="testnet">This is a test network</label>
            <button class="primary" type="submit">Verify & add chain</button>
          </fieldset></form>
          <details><summary>Connection or capability errors?</summary><p class="help">Older HTTP APIs may not expose the operator endpoints. Update the node’s endpoints package to a version supporting chain-manager operations, restart the node, and verify its HTTP API and browser CORS configuration. Do not bypass identity verification.</p></details>
        </section>
      </div>`
  }
  private wallet() {
    const c = this.controller
    return html`${this.intro('Your wallet. Your custody.', 'Only encrypted wallet data is persisted. The unlocked wallet lives in memory; switching chains locks it. No private key or mnemonic is displayed here.')}
      <div class="banner warning"><strong>Back up before funding.</strong><p>Save your encrypted backup in a safe location and keep its password separately. Losing either can mean losing access to your funds. A download request does not prove your backup is safely stored.</p></div>
      <div class="grid"><section class="panel"><div class="section-head"><h2>Wallet access</h2><span class="badge ${c.walletUnlocked ? '' : 'neutral'}">${c.walletUnlocked ? 'Unlocked' : 'Locked'}</span></div>
        ${c.walletUnlocked ? html`<dl>${this.row('Address', c.walletAddress || 'Not available')}${this.row('Balance · LFC', c.status?.balance)}</dl>
          <button class="primary" ?disabled=${this.busy} @click=${() => void this.run(() => { c.cancelPrepared(); c.lockWallet() })}>Lock wallet now</button>
          <p class="help" style="margin-top:12px">Locking also cancels the prepared transaction.</p>`
        : c.walletExists ? html`<p class="muted">Unlock the existing encrypted wallet for this session.</p>
          <form @submit=${(event: SubmitEvent) => this.walletAction(event, 'unlock')}><fieldset ?disabled=${this.busy}>
            <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
            <button class="primary">Unlock wallet</button></fieldset></form>`
        : html`<p class="muted">Create a wallet and download its encrypted backup. Use a strong, unique password of at least 12 characters.</p>
          <form @submit=${(event: SubmitEvent) => this.walletAction(event, 'create')}><fieldset ?disabled=${this.busy}>
            <label>New wallet password<input type="password" name="password" minlength="12" required autocomplete="new-password" aria-describedby="password-help"></label>
            <p class="help" id="password-help">At least 12 characters. The password field is cleared immediately after use.</p>
            <button class="primary">Create & download encrypted backup</button></fieldset></form>`}
        ${c.walletExists ? html`<hr><h3>Encrypted backup</h3><p class="help">Export the existing encrypted backup. No plaintext secrets are included.</p>
          <button style="margin-top:14px" ?disabled=${this.busy} @click=${() => void this.run(() => {
            downloadBackup(c.exportWallet()); this.localNotice = 'Encrypted backup download requested. Verify the file is safely stored.'
          })}>Download encrypted backup</button>` : nothing}
      </section>
      <section class="panel"><h2>Restore a backup</h2><p class="muted">Choose an encrypted wallet backup (JSON, up to 1 MiB) and enter its original password.</p>
        ${c.walletExists ? html`<p class="banner warning">A wallet already exists. Replacement is deliberately refused. Recovery import is available only in a fresh application instance with no saved wallet. Keep your existing backup safe; do not delete wallet data to experiment with recovery.</p>` : nothing}
        <form @submit=${(event: SubmitEvent) => this.walletAction(event, 'import')}><fieldset ?disabled=${this.busy || c.walletExists}>
          <label>Encrypted backup file<input type="file" name="backup" accept=".json,application/json" required></label>
          <label>Backup password<input type="password" name="password" required autocomplete="current-password"></label>
          <button>Import encrypted wallet</button>
        </fieldset></form>
      </section></div>`
  }
  private contractFields(prefix: string) {
    return html`<label>Contract address<input name="contract" required spellcheck="false" autocomplete="off"></label>
      <label>Method<input name="method" required spellcheck="false" placeholder=${prefix === 'read' ? 'balanceOf' : 'transfer'}></label>
      <label>Parameters · JSON array<textarea name="params" class="mono" required spellcheck="false">[]</textarea></label>`
  }
  private contracts() {
    return html`${this.intro('Read. Call. Deploy.', 'Inspect contract state without signing, or prepare a transaction for explicit review. JSON parameters must be arrays.')}
      ${this.signingHint()}
      <div class="grid">
        <section class="panel"><h2>Read contract state</h2><p class="muted">A static call does not broadcast a transaction.</p>
          <form @submit=${this.read}><fieldset ?disabled=${this.busy || !this.controller.active}>${this.contractFields('read')}<button>Run static call</button></fieldset></form>
          ${this.staticResult !== undefined ? html`<h3 style="margin-top:24px">Result</h3><pre aria-live="polite">${this.staticResult}</pre>` : nothing}
        </section>
        <section class="panel"><h2>Call a contract</h2><p class="muted">Preparation signs the call locally to quote exact serialized fees. Review the fee and exact parameters before authorizing a broadcast.</p>
          <form @submit=${this.call}><fieldset ?disabled=${!this.canSign}>${this.contractFields('write')}<button class="primary">Prepare call</button></fieldset></form>
        </section>
        <section class="panel" style="grid-column:1 / -1"><div class="section-head"><div><h2>Deploy a contract</h2><p class="help">Paste a self-contained JavaScript class. No external imports or network dependencies.</p></div>
          <div class="actions"><button ?disabled=${this.busy || !!this.controller.prepared} @click=${() => { this.source = FAUCET_SOURCE; this.constructorParams = '[]' }}>Use prefunded faucet template</button>
            <button ?disabled=${this.busy || !!this.controller.prepared} @click=${() => this.resetSetup()}>Reset setup</button></div></div>
          <p class="banner warning">Registration costs require an existing allowance. A deployment does not create an allowance or fund a faucet automatically.</p>
          <form @submit=${this.deploy}><fieldset ?disabled=${!this.canSign}>
            <label>JavaScript class source<textarea name="source" class="mono code" required spellcheck="false" .value=${this.source} @input=${(event: Event) => { this.source = (event.target as HTMLTextAreaElement).value }}></textarea></label>
            <label>Constructor parameters · JSON array<textarea name="params" class="mono" required spellcheck="false" .value=${this.constructorParams} @input=${(event: Event) => { this.constructorParams = (event.target as HTMLTextAreaElement).value }}></textarea></label>
            <p class="help">Faucet template parameters: <code>[nativeToken, claimUnits, cooldownMs, budgetUnits]</code>. Supply the native token address from node status and use the template’s integer base units for claim and budget values, not human LFC decimals. The budget limits lifetime claims, not daily claims; refilling does not reset that budget. This is a prefunded faucet: fund its deployed address separately, users invoke <code>claim()</code>, and treasury withdrawal follows its authorization rules. Native LFC minting is blocked.</p>
            <button class="primary">Prepare deployment</button>
          </fieldset></form>
        </section>
      </div>`
  }
  private faucet() {
    const testnet = this.controller.active?.testnet === true
    const setup = this.controller.faucetSetup
    const step = this.controller.faucetStep
    return html`${this.intro('Fund with intention.', 'Testnet-only operator tools for existing accounts and contracts. Preparation signs locally; every broadcast requires explicit review and consent. There is no scheduled funding or automatic broadcasting.')}
      ${!testnet ? html`<p class="banner warning">Funding and mint tools are disabled. Select a verified testnet profile to continue.</p>` : this.signingHint()}
      <section class="panel">
        <h2>Guided faucet installation</h2>
        <p class="muted">Configure → approve factory allowance → deploy → confirm → fund → verify claim capacity. Each transaction has its own review; no automatic claims or broadcasts.</p>
        ${setup ? html`
          <dl>${this.row('Chain ID', setup.chainId)}${this.row('Owner', setup.owner)}${this.row('Expected faucet address', setup.address)}
            ${this.row('Claim · LFC', setup.claim)}${this.row('Cooldown · seconds', setup.cooldownMs / 1000)}
            ${this.row('Lifetime budget · LFC', setup.budget)}${this.row('Initial funding · LFC', setup.funding)}</dl>
          <p role="status">Next step: ${step || 'Check on-chain progress'}</p>
          <div class="actions">
            <button ?disabled=${this.busy || !!this.controller.prepared} @click=${() => void this.run(() => this.controller.checkFaucetSetup())}>Check setup progress</button>
            <button ?disabled=${this.busy || !!this.controller.prepared} @click=${() => void this.run(async () => { await this.controller.refreshActivity(); await this.controller.checkFaucetSetup() })}>Reconcile setup transactions</button>
            ${step && ['approval', 'deploy', 'fund'].includes(step) ? html`<button class="primary" ?disabled=${!this.canSign} @click=${() => this.prepareFaucet()}>Prepare ${step === 'approval' ? 'allowance' : step === 'deploy' ? 'faucet deployment' : 'initial funding'}</button>` : nothing}
          </div>
          <p class="help">Saved locally per wallet and chain. Reloading does not repeat confirmed setup steps. Waiting or unknown transactions must be reconciled, never blindly resent. Verification reads the contract configuration, balance and budget; it does not execute a claim.</p>
        ` : html`<form @submit=${this.configureFaucet}><fieldset ?disabled=${!testnet || !this.canSign}>
          <div class="grid"><label>Claim amount · LFC<input name="claim" inputmode="decimal" required value="1"></label>
          <label>Cooldown · seconds<input name="cooldown" type="number" min="60" step="1" required value="86400"></label>
          <label>Lifetime budget · LFC<input name="budget" inputmode="decimal" required value="1000"></label>
          <label>Initial funding · LFC<input name="funding" inputmode="decimal" required value="100"></label></div>
          <p class="help">Existing test LFC only. The budget never resets; claim size and budget are immutable in this template. Factory registration costs and transaction fees are additional. Per-account limits are not Sybil protection.</p>
          <button class="primary">Save faucet setup</button>
        </fieldset></form>`}
      </section>
      <div class="grid">
        <section class="panel"><h2>Fund an account or faucet</h2><p class="muted">Transfer existing native LFC from your wallet. To refill a deployed prefunded faucet, use its contract address.</p>
          <form @submit=${this.fund}><fieldset ?disabled=${!testnet || !this.canSign}>
            <label>Recipient account or contract<input name="recipient" required spellcheck="false"></label>
            <label>Amount · LFC<input name="amount" required inputmode="decimal" pattern="[0-9]+([.][0-9]+)?" placeholder="0.00" aria-describedby="fund-help"></label>
            <p id="fund-help" class="help">Human LFC decimals, not base units. Your wallet must cover the amount and the transaction fee.</p>
            <button class="primary">Prepare funding</button>
          </fieldset></form>
        </section>
        <section class="panel"><h2>Refill a custom token</h2><p class="muted">Optional role-authorized mint for custom tokens only. Native LFC minting is not supported. The controller verifies your minting role.</p>
          <form @submit=${this.mint}><fieldset ?disabled=${!testnet || !this.canSign}>
            <label>Custom token contract<input name="token" required spellcheck="false"></label>
            <label>Recipient account or contract<input name="recipient" required spellcheck="false"></label>
            <label>Amount<input name="amount" required inputmode="decimal" pattern="[0-9]+([.][0-9]+)?" placeholder="0.00"></label>
            <button>Prepare custom-token mint</button>
          </fieldset></form>
        </section>
      </div>`
  }
  private activity() {
    const c = this.controller
    const entries = c.activity.filter(entry => entry.profileId === c.activeId)
    return html`${this.intro('Follow the outcome.', 'Submission is not confirmation. Refresh explicitly to check receipts on the selected chain. Unknown means the outcome could not be verified—not that it failed.')}
      <section class="panel"><div class="section-head"><h2>Selected-chain activity</h2><button ?disabled=${this.busy || !c.active} @click=${() => void this.run(() => c.refreshActivity())}>Refresh receipts</button></div>
        <p class="help">Pending transactions are awaiting confirmation. Do not resubmit an unknown transaction until you have checked its hash with the node.</p>
        ${!entries.length ? html`<div style="margin-top:24px">${this.empty('No recorded transactions', 'Transactions submitted from this workspace will appear here. This is not a complete chain history.')}</div>` : entries.map(entry => html`
          <article class="activity"><div class="section-head" style="margin-top:20px"><h3>${entry.kind}</h3><span class="badge ${entry.status === 'failed' ? 'failed' : entry.status === 'confirmed' ? '' : 'warn'}">${entry.status}</span></div>
            <p class="help">${new Date(entry.createdAt).toLocaleString()}</p>
            <dl>${this.row('Transaction hash', entry.hash || 'Not yet available')}${this.row('Chain ID', entry.chainId)}
              ${entry.contractAddress ? this.row('Contract address', entry.contractAddress) : nothing}</dl>
            ${entry.error ? html`<p class="banner error">${entry.error}</p>` : nothing}
          </article>`)}
      </section>`
  }
  private review(review: Review) {
    const c = this.controller
    const matches = review.chainId === c.active?.chainId && review.endpoint === c.active?.endpoint && c.walletUnlocked && review.from === c.walletAddress
    const deployment = this.deploymentSource?.id === review.id ? this.deploymentSource : undefined
    const deploymentReady = review.kind !== 'deploy' || (!!deployment && this.sourceAcknowledged && !!review.contractAddress)
    return html`<section class="panel review" aria-labelledby="review-heading">
      <p class="eyebrow">Prepared and signed locally; not broadcast</p><h2 id="review-heading" tabindex="-1">Review ${review.kind === 'deploy' ? 'deployment' : review.kind}</h2>
      <p class="muted">Check every field against your intended chain and recipient. Signature stays in memory. Submitting broadcasts this exact reviewed transaction after checks.</p>
      <p class="help">Preparation signs locally to quote exact serialized fees. Before broadcasting, the controller rechecks chain identity, nonce and balance.</p>
      ${review.workflowStep === 'approval' ? html`<p class="banner warning">This allowance authorizes the factory to spend up to ${review.amount} LFC for registration. It does not fund the faucet. Deployment and initial funding require separate approval.</p>` : nothing}
      ${!matches ? html`<p class="banner error">The active connection or unlocked wallet no longer matches this review. Cancel and prepare again.</p>` : nothing}
      <dl>${this.row('Chain ID', review.chainId)}${this.row('Endpoint', review.endpoint)}
        ${this.row('Sender', review.from)}${this.row('Target', review.to)}${this.row('Method', review.method)}
        ${this.row('Parameters', JSON.stringify(review.params, null, 2))}
        ${this.row('Amount · LFC', review.amount ?? 'Not applicable')}${this.row('Fee · LFC', review.fee)}
        ${review.kind === 'deploy' ? this.row('Deployed address', review.contractAddress || 'Not provided; cancel and prepare again') : nothing}
        ${this.row('Prepared at', new Date(review.createdAt).toLocaleString())}</dl>
      ${review.kind === 'deploy' ? deployment ? html`
        <h3 style="margin-top:24px">Exact source submitted for preparation</h3>
        <p class="help">The transaction parameters may expose a source hash rather than the code. Review this captured source and constructor input, not just the hash.</p>
        <pre tabindex="0" aria-label="Prepared JavaScript source">${deployment.source}</pre>
        <h3>Constructor input · JSON array</h3><pre tabindex="0" aria-label="Prepared constructor input">${deployment.params}</pre>
      ` : html`<p class="banner error">The original source is unavailable in this session. Cancel and prepare the deployment again to review its exact code.</p>` : nothing}
      <form @submit=${(event: SubmitEvent) => {
        event.preventDefault()
        if (!matches || !this.acknowledged || !deploymentReady) return
        void this.run(() => c.submitPrepared())
      }}>
        <label class="check"><input type="checkbox" .checked=${this.acknowledged} ?disabled=${this.busy} @change=${(event: Event) => { this.acknowledged = (event.target as HTMLInputElement).checked }}>
          I checked the full chain ID, endpoint, sender, target, parameters, amount and fee. I authorize broadcasting this exact reviewed transaction.</label>
        ${review.kind === 'deploy' ? html`<label class="check"><input type="checkbox" .checked=${this.sourceAcknowledged} ?disabled=${this.busy} @change=${(event: Event) => { this.sourceAcknowledged = (event.target as HTMLInputElement).checked }}>
          I reviewed the complete source and constructor parameters I supplied, trust this code, and understand registration consumes my existing allowance. Deployment does not automatically fund the contract.</label>` : nothing}
        <div class="actions"><button type="submit" class="primary" ?disabled=${this.busy || !matches || !this.acknowledged || !deploymentReady}>Broadcast reviewed transaction</button>
          <button type="button" ?disabled=${this.busy} @click=${() => void this.run(() => c.cancelPrepared())}>Cancel prepared action</button></div>
      </form>
    </section>`
  }
  override render() {
    const c = this.controller
    const error = this.localError || c.error
    const notice = this.localNotice || c.notice
    return html`<div class="shell">
      <aside><div class="brand">CHAIN MANAGER<span>Leofcoin / Operator</span></div>
        <nav aria-label="Main navigation">${pages.map(page => html`<button aria-current=${this.page === page ? 'page' : nothing} @click=${() => this.navigate(page)}>${page[0].toUpperCase() + page.slice(1)}</button>`)}</nav>
        <p class="sidebar-note">Local signing.<br>Explicit approvals.<br>No automatic broadcasts.</p>
      </aside>
      <main>
        <div class="topbar"><div class="connection"><strong>${c.active?.name || 'No chain selected'}</strong>
          <span class="badge ${c.active?.testnet ? 'warn' : 'neutral'}">${c.active ? c.active.testnet ? 'Testnet' : 'Live network' : 'Not connected'}</span>
          ${c.status ? html`<span class="badge ${c.status.synced ? '' : 'warn'}">${c.status.synced ? 'Synced' : 'Not synced'}</span>` : nothing}
        </div><div class="actions"><span class="help" role="status">${this.busy ? 'Working…' : c.walletUnlocked ? 'Wallet unlocked' : 'Wallet locked'}</span>
          ${c.walletUnlocked ? html`<button class="quiet" ?disabled=${this.busy} @click=${() => void this.run(() => { c.cancelPrepared(); c.lockWallet() })}>Lock</button>` : nothing}
          <button ?disabled=${this.busy || !c.active} @click=${() => void this.run(() => c.refresh())}>Refresh node</button></div>
        </div>
        ${error ? html`<div class="banner error" role="alert"><strong>Action could not be completed</strong><p>${error}</p><p class="help">For missing or unsupported HTTP methods, update the node’s endpoints package and restart the node. Verify the selected API endpoint before retrying.</p></div>` : nothing}
        ${notice ? html`<div class="banner" role="status">${notice}</div>` : nothing}
        ${c.prepared ? this.review(c.prepared) : nothing}
        ${this.page === 'overview' ? this.overview() : this.page === 'chains' ? this.chains() : this.page === 'wallet' ? this.wallet() :
          this.page === 'contracts' ? this.contracts() : this.page === 'faucet' ? this.faucet() : this.page === 'activity' ? this.activity() :
          html`${this.intro('Plan the beginning.', 'Generate verified public genesis bundles separately from live operator actions. Bundle generation does not start nodes or broadcast a wallet transaction.')}<div class="planner"><manager-view></manager-view></div>`}
      </main>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap { 'chain-manager-app': ChainManagerApp }
}
