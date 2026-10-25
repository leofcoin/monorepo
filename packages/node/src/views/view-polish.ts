import { css, html, svg } from 'lit'

export type IdentityAccount = [name: string, external: string, internal: string]
type Illustration = 'identity' | 'accounts' | 'backup' | 'validator'

export const viewIllustration = (kind: Illustration) => html`
  <svg class="hero-art" viewBox="0 0 120 120" fill="none" aria-hidden="true">
    <circle cx="60" cy="60" r="48" stroke="currentColor" stroke-opacity=".18" stroke-dasharray="3 7"/>
    ${kind === 'validator' ? svg`
      <path d="M60 20 89 32v24c0 22-15 36-29 43-14-7-29-21-29-43V32Z" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="2"/>
      <path d="m46 58 10 10 20-23" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ` : kind === 'backup' ? svg`
      <rect x="30" y="43" width="60" height="48" rx="12" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="2"/>
      <path d="M44 43V32a16 16 0 0 1 32 0v11M60 61v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    ` : kind === 'accounts' ? svg`
      <rect x="36" y="25" width="57" height="66" rx="12" stroke="currentColor" stroke-opacity=".4" stroke-width="2"/>
      <rect x="25" y="35" width="57" height="66" rx="12" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="2"/>
      <circle cx="54" cy="57" r="8" stroke="currentColor" stroke-width="2"/>
      <path d="M39 85c1-13 28-13 29 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    ` : svg`
      <rect x="24" y="32" width="72" height="58" rx="12" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="2"/>
      <circle cx="46" cy="53" r="8" stroke="currentColor" stroke-width="2"/>
      <path d="M33 76c1-14 25-14 26 0m10-25h15m-15 12h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    `}
    <path class="spark" d="m97 16 2.5 7.5L107 26l-7.5 2.5L97 36l-2.5-7.5L87 26l7.5-2.5Z" fill="currentColor"/>
    <circle class="spark" cx="22" cy="94" r="4" fill="currentColor" opacity=".6"/>
  </svg>`

export const viewHeader = (kind: Illustration, eyebrow: string, title: string, description: string) => html`
  <header class="hero">
    ${viewIllustration(kind)}
    <span class="eyebrow">${eyebrow}</span>
    <h1>${title}</h1>
    <p class="muted">${description}</p>
  </header>`

export const viewPolish = css`
  :host { display: block; width: 100%; min-width: 0; height: 100%; overflow: auto; box-sizing: border-box;
    padding: clamp(14px, 2vw, 24px) 16px 28px; color: var(--md-sys-color-on-surface, #eee); }
  * { box-sizing: border-box; }
  main { width: 100%; max-width: 860px; min-width: 0; margin: auto; display: grid; gap: 20px; }
  .hero { position: relative; overflow: hidden; padding: 28px 148px 28px 28px; border: 1px solid var(--lfc-glass-border, #51474e);
    border-radius: 24px; background: radial-gradient(ellipse at top right, color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 18%, transparent), transparent 75%); }
  .hero-art { position: absolute; right: 16px; top: 20px; width: 110px; height: 110px; color: var(--md-sys-color-primary, #8dbbff); }
  .spark { transform-box: fill-box; transform-origin: center; animation: sparkle 3s ease-in-out 2; }
  .spark:last-child { animation-delay: .5s; }
  h1, h2, h3, p { margin: 0; }
  h1 { font-size: clamp(26px, 4vw, 32px); letter-spacing: -.035em; margin: 8px 0 12px; }
  h2 { font-size: 19px; } h3 { font-size: 15px; }
  p { line-height: 1.65; }
  .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--md-sys-color-primary, #8dbbff); }
  .muted { color: var(--md-sys-color-on-surface-variant, #ccc); font-size: 13px; }
  .card { min-width: 0; padding: 22px; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 20px;
    background: var(--lfc-glass-surface, #242126); animation: arrive 320ms ease-out both; }
  .card:nth-child(3) { animation-delay: 60ms; }
  .card:nth-child(4) { animation-delay: 120ms; }
  .section-title { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
  .section-title h2 { flex: 1; }
  .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .metric { position: relative; overflow: hidden; }
  .metric strong { display: block; margin-top: 12px; font-size: 32px; font-variant-numeric: tabular-nums; }
  .metric .account-status { font-size: 22px; }
  .metric svg { position: absolute; width: 82px; height: 82px; right: 12px; top: 12px; opacity: .16; color: var(--md-sys-color-primary, #8dbbff); }
  .metric:nth-child(2) svg { color: var(--md-sys-color-tertiary, #dfb8fa); }
  .avatar { display: grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; border-radius: 15px;
    background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 16%, transparent); color: var(--md-sys-color-primary, #8dbbff); font-weight: 700; }
  .row { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .row-info { flex: 1; min-width: 0; display: grid; gap: 5px; }
  .row-info strong { overflow-wrap: anywhere; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
  a, button, summary { -webkit-tap-highlight-color: transparent; }
  button, .button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: inherit; font-size: 13px; text-decoration: none;
    border-radius: 12px; min-height: 44px; padding: 10px 14px; cursor: pointer; border: 1px solid transparent;
    background: var(--lfc-action, #1d64d8); color: var(--lfc-on-action, #fff); font-weight: 600;
    transition: background 160ms ease, box-shadow 160ms ease, transform 160ms ease; }
  .secondary { background: transparent; border-color: var(--lfc-glass-border, #51474e); color: inherit; }
  button:disabled { opacity: .5; cursor: default; }
  input { width: 100%; min-width: 0; min-height: 44px; margin: 10px 0 14px; padding: 10px 14px;
    border-radius: 12px; border: 1px solid var(--lfc-glass-border, #51474e); background: var(--md-sys-color-surface-container, #171619); color: inherit; font: inherit; font-size: 16px; }
  button:hover:not(:disabled), .button:hover { box-shadow: 0 4px 16px rgb(0 0 0 / 12%); transform: translateY(-2px); }
  .secondary:hover:not(:disabled) { background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 9%, transparent); }
  button:active:not(:disabled), .button:active { transform: translateY(0); }
  :focus-visible { outline: 2px solid var(--md-sys-color-primary, #8dbbff); outline-offset: 3px; }
  .empty { display: grid; justify-items: center; gap: 12px; padding: 28px 16px; text-align: center; }
  .empty .hero-art { position: static; width: 80px; height: 80px; }
  .badge { display: inline-flex; align-items: center; gap: 7px; border-radius: 9px; padding: 5px 9px; font-size: 12px;
    background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 12%, transparent); color: var(--md-sys-color-primary, #8dbbff); }
  code, .address { overflow-wrap: anywhere; font-size: 12px; line-height: 1.7; }
  .error { color: var(--md-sys-color-error, #ffb4ab); overflow-wrap: anywhere; }
  .feedback { font-size: 13px; overflow-wrap: anywhere; }
  .feedback:empty { display: none; }
  details { border-bottom: 1px solid var(--lfc-glass-border, #51474e); }
  details:last-child { border-bottom: 0; }
  summary { cursor: pointer; padding: 14px 0; list-style: none; border-radius: 10px; transition: background 160ms ease; }
  summary::-webkit-details-marker { display: none; }
  summary:hover { background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 6%, transparent); }
  .chevron { transition: transform 180ms ease; font-size: 22px; color: var(--md-sys-color-primary, #8dbbff); }
  details[open] .chevron { transform: rotate(90deg); }
  .detail-body { display: grid; gap: 16px; padding: 8px 0 20px; animation: arrive 200ms ease-out; }
  .address-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; }
  .address-row > div { display: grid; gap: 5px; min-width: 0; }
  .security-note { display: grid; gap: 10px; border-left: 3px solid var(--md-sys-color-tertiary, #dfb8fa); }
  .loading { animation: breathe 1.5s ease-in-out infinite; }
  @keyframes arrive { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sparkle { 0%, 100% { transform: scale(.85); opacity: .5; } 50% { transform: scale(1.1); opacity: 1; } }
  @keyframes breathe { 50% { opacity: .45; } }
  @media (max-width: 540px) {
    .hero { padding: 22px 90px 22px 22px; }
    .hero-art { width: 70px; height: 70px; right: 10px; }
    .card { padding: 16px; }
    .metrics { gap: 12px; }
    .metric strong { font-size: 28px; }
    .address-row { grid-template-columns: minmax(0, 1fr); }
    .address-row button { justify-self: start; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
    button:hover:not(:disabled), .button:hover { transform: none; }
  }
`
