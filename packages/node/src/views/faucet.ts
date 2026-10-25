import { LitElement, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { getSelectedNetwork } from '../network-selection.js'
import { viewHeader, viewPolish } from './view-polish.js'
import '../elements/testnet-faucet.js'

@customElement('faucet-view')
export class FaucetView extends LitElement {
  @property({ type: Object }) accessor wallet: { selectedAccount?: string } | undefined

  static styles = viewPolish

  render() {
    if (getSelectedNetwork().key !== 'peach')
      return html`<main><section class="card" role="alert"><h1>Testnet only</h1><p>The faucet is not available on this network.</p></section></main>`
    return html`<main>
      ${viewHeader('accounts', 'PEACH TESTNET', 'Get test LFC', 'Fund your test wallet to explore transfers and contracts. Test tokens have no monetary value.')}
      <section class="card">
        ${this.wallet?.selectedAccount ? html`
          <div class="section-title"><h2>Your receiving address</h2><span class="badge">Testnet only</span></div>
          <p class="address">${this.wallet.selectedAccount}</p>
          <div class="actions"><testnet-faucet .address=${this.wallet.selectedAccount}></testnet-faucet></div>`
          : html`<h2>Unlock your wallet first</h2><p class="muted">Open your wallet to choose the account that will receive test tokens.</p><div class="actions"><a class="button" href="#!/wallet">Open wallet</a></div>`}
      </section>
    </main>`
  }
}
