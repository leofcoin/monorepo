import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatUnits } from '@leofcoin/utils'
import { formatRankingBalance, rankActivity, rankHolders } from '../../controllers/explorer-rankings.js'

const shortAddress = (address: string) => address.length > 22 ? `${address.slice(0, 10)}…${address.slice(-8)}` : address

@customElement('explorer-dashboard-rankings')
export class DashboardRankings extends LitElement {
  @property({ type: Object }) accessor activity = rankActivity([])
  @property({ type: Object }) accessor holders: ReturnType<typeof rankHolders> | undefined
  @property() accessor holderError = ''
  @property({ type: Boolean }) accessor loading = true

  static styles = css`
    :host { display: block; width: 100%; max-width: 1200px; box-sizing: border-box; padding: 0 24px; color: var(--md-sys-color-on-surface, #eee); margin: 24px 0; }
    .heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin: 0 4px 14px; }
    .heading h2 { margin: 0; font-size: 19px; }
    .period { padding: 5px 10px; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 999px; font-size: 11px; }
    .rankings { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    section { --rank-accent: var(--md-sys-color-primary, #8dbbff); display: flex; flex-direction: column; padding: 20px; border-radius: 20px; border: 1px solid var(--lfc-glass-border, #51474e); background: linear-gradient(145deg, color-mix(in srgb, var(--rank-accent) 5%, transparent), transparent 65%), var(--lfc-glass-surface, #242126); min-width: 0; }
    section:nth-child(2) { --rank-accent: var(--md-sys-color-tertiary, #d7b9ff); }
    section:nth-child(3) { --rank-accent: var(--md-sys-color-secondary, #80d6a5); }
    h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; font-size: 17px; }
    h2 svg { width: 20px; height: 20px; padding: 8px; border-radius: 12px; background: color-mix(in srgb, var(--rank-accent) 12%, transparent); color: var(--rank-accent); flex-shrink: 0; }
    p { margin: 0; }
    .muted { color: var(--md-sys-color-on-surface-variant, #ccc); font-size: 12px; line-height: 1.5; }
    ol { list-style: none; padding: 0; margin: 14px 0 0; }
    li { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 10px; padding: 12px 0; border-top: 1px solid var(--lfc-glass-border, #51474e); }
    .rank { color: var(--rank-accent); font-size: 11px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 8px; background: color-mix(in srgb, var(--rank-accent) 10%, transparent); }
    .details { min-width: 0; display: grid; gap: 6px; }
    .address { font: 12px ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .values { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; font-size: 13px; font-variant-numeric: tabular-nums; }
    .track { height: 3px; background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 10%, transparent); border-radius: 4px; overflow: hidden; }
    .track span { display: block; height: 100%; background: var(--rank-accent); border-radius: inherit; }
    .values strong { font-size: 16px; font-weight: 600; overflow-wrap: anywhere; letter-spacing: -.02em; }
    .values small { font-size: 10px; font-weight: 500; color: var(--md-sys-color-on-surface-variant, #ccc); letter-spacing: .06em; }
    .empty { display: grid; justify-items: center; align-content: center; gap: 9px; flex: 1; padding: 26px 12px; text-align: center; min-height: 116px; }
    .empty svg { width: 46px; height: 46px; color: var(--rank-accent); opacity: .65; }
    .empty strong { font-size: 13px; }
    details { margin-top: 12px; font-size: 11px; color: var(--md-sys-color-on-surface-variant, #ccc); line-height: 1.5; }
    summary { cursor: pointer; width: fit-content; }
    details p { margin-top: 8px; }
    summary:focus-visible { outline: 2px solid var(--rank-accent); outline-offset: 4px; }
    .error { color: var(--md-sys-color-error, #ffb4ab); font-size: 13px; margin-top: 16px; }
    @media (max-width: 900px) { .rankings { grid-template-columns: 1fr; } }
    @media (max-width: 480px) { :host { padding: 0 12px; } }
  `

  render() {
    const activity = this.activity
    const period = activity.blocks ? `${activity.blocks} sampled blocks · #${activity.start}–#${activity.end}` : 'No recent blocks'
    return html`<div class="heading"><h2>On-chain leaders</h2><span class="period muted">${period}</span></div>
    <div class="rankings">
      <section aria-labelledby="holders-heading">
        <h2 id="holders-heading"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8h16v12H4zM3 4h18v4H3zM9 12h6" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>Top LFC holders</h2>
        <p class="muted">${this.holders?.total ?? '—'} funded ${this.holders?.total === 1 ? 'address' : 'addresses'} · Current balances</p>
        ${this.holderError ? html`<p class="error" role="alert">${this.holderError}</p>`
          : this.loading ? html`<p class="muted empty">Loading balances...</p>`
          : !this.holders?.holders.length ? html`<p class="muted empty">No funded addresses.</p>`
          : html`<ol>${this.holders.holders.map((holder, index) => html`<li>
              <span class="rank">${index + 1}</span><div class="details">
                <span class="address" title=${holder.address} aria-label=${holder.address}>${shortAddress(holder.address)}</span>
                <div class="values"><strong title=${`${formatUnits(holder.balance)} LFC`}>${formatRankingBalance(holder.balance)} <small>LFC</small></strong><span class="muted">${holder.share.toFixed(2)}%</span></div>
                <div class="track" aria-hidden="true"><span style=${`width:${holder.share}%`}></span></div>
              </div>
            </li>`)}</ol>`}
        <details><summary>About this ranking</summary><p>Current local chain balances, including contract addresses, not individual people. Percentages use the sum of balances. Amounts show up to four decimals; hover for the exact value.</p></details>
      </section>
      <section aria-labelledby="contracts-heading">
        <h2 id="contracts-heading"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>Most used contracts</h2>
        <p class="muted">Top 5 by contract calls</p>
        ${!activity.contracts.length ? html`<div class="empty">
            <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="5" y="8" width="38" height="32" rx="8" stroke="currentColor" stroke-width="1.5"/><path d="m18 19-5 5 5 5m12-10 5 5-5 5m-4-13-4 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <strong>No calls yet</strong><p class="muted">No contract calls in this sample.</p></div>`
          : html`<ol>${activity.contracts.map((contract, index) => html`<li>
              <span class="rank">${index + 1}</span><div class="details">
                <span class="address" title=${contract.address} aria-label=${contract.address}>${shortAddress(contract.address)}</span>
                <div class="values"><strong>${contract.count} calls</strong><span class="muted">${contract.callers} unique callers</span></div>
                <div class="track" aria-hidden="true"><span style=${`width:${contract.count / activity.contracts[0].count * 100}%`}></span></div>
              </div>
            </li>`)}</ol>`}
        <details><summary>About this ranking</summary><p>${period}. Top-level method calls including the native token. Internal calls and read-only requests are excluded.</p></details>
      </section>
      <section aria-labelledby="addresses-heading">
        <h2 id="addresses-heading"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12h4l3-8 4 16 3-8h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>Most active addresses</h2>
        <p class="muted">Top 5 by sent transactions</p>
        ${!activity.addresses.length ? html`<div class="empty">
            <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 4"/><path d="M10 24h8l4-10 5 20 4-10h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <strong>Waiting for activity</strong><p class="muted">No sent transactions in this sample.</p></div>`
          : html`<ol>${activity.addresses.map((sender, index) => html`<li>
              <span class="rank">${index + 1}</span><div class="details">
                <span class="address" title=${sender.address} aria-label=${sender.address}>${shortAddress(sender.address)}</span>
                <div class="values"><strong>${sender.count} transactions</strong></div>
                <div class="track" aria-hidden="true"><span style=${`width:${sender.count / activity.addresses[0].count * 100}%`}></span></div>
              </div>
            </li>`)}</ol>`}
        <details><summary>About this ranking</summary><p>${period}. Counts sent transactions, not received transfers or unique users.</p></details>
      </section>
    </div>`
  }
}
