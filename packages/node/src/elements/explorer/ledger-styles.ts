import { css } from 'lit'

export const ledgerStyles = css`
  :host { display: block; width: 100%; height: 100%; min-width: 0; overflow: auto; box-sizing: border-box; color: var(--md-sys-color-on-surface, #eee); }
  * { box-sizing: border-box; }
  main { max-width: 1240px; margin: auto; padding: 28px 24px; display: grid; gap: 20px; min-width: 0; }
  h1, h2, p { margin: 0; }
  h1 { font-size: clamp(26px, 4vw, 34px); letter-spacing: -.04em; margin: 6px 0 10px; }
  h2 { font-size: 17px; }
  p { font-size: 13px; line-height: 1.7; color: var(--md-sys-color-on-surface-variant, #bbc); }
  .eyebrow { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--md-sys-color-primary, #9fc4ff); font-weight: 700; }
  .heading, .toolbar, footer, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .heading > div { flex: 1; min-width: 200px; }
  .panel { min-width: 0; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 20px; background: var(--lfc-glass-surface, #242126); overflow: hidden; }
  .toolbar, footer { padding: 16px 20px; }
  .toolbar { border-bottom: 1px solid var(--lfc-glass-border, #51474e); }
  footer { border-top: 1px solid var(--lfc-glass-border, #51474e); }
  footer .buttons { display: flex; gap: 8px; }
  .muted, .caption { color: var(--md-sys-color-on-surface-variant, #bbc); font-size: 12px; }
  .caption { padding: 0 20px 16px; }
  button, .button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; border-radius: 12px; padding: 8px 14px; border: 1px solid var(--lfc-glass-border, #51474e); background: transparent; color: inherit; font: inherit; font-size: 12px; text-decoration: none; cursor: pointer; }
  button:hover:not(:disabled), .button:hover { background: var(--md-sys-color-surface-container-high, #34313a); }
  button:disabled { opacity: .4; cursor: default; }
  a { color: var(--md-sys-color-primary, #9fc4ff); text-decoration: none; }
  a:hover { text-decoration: underline; }
  :focus-visible { outline: 2px solid var(--md-sys-color-primary, #9fc4ff); outline-offset: 3px; }
  input, select { min-height: 44px; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 10px; padding: 8px 12px; background: var(--md-sys-color-surface-container-low, #1d1b20); color: inherit; font: inherit; font-size: 13px; min-width: 0; }
  input { width: min(320px, 100%); }
  .table-scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
  th { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; font-weight: 600; color: var(--md-sys-color-on-surface-variant, #bbc); background: var(--md-sys-color-surface-container-low, #1d1b20); }
  th, td { padding: 16px 20px; white-space: nowrap; border-bottom: 1px solid var(--lfc-glass-border, #51474e); }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: color-mix(in srgb, var(--md-sys-color-primary, #9fc4ff) 4%, transparent); }
  .numeric { text-align: right; font-variant-numeric: tabular-nums; }
  code { font-size: 11px; font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
  .row-hash { display: inline-block; max-width: 23ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
  .badge { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; background: var(--md-sys-color-secondary-container, #393d4a); color: var(--md-sys-color-on-secondary-container, #e2e2ef); padding: 4px 8px; font-size: 11px; }
  .state { padding: 44px 24px; text-align: center; display: grid; justify-items: center; gap: 12px; }
  .state > span { font-size: 32px; color: var(--md-sys-color-primary, #9fc4ff); }
  .error { color: var(--md-sys-color-error, #ffb4ab); overflow-wrap: anywhere; }
  .warning { border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 12px; padding: 12px 16px; font-size: 12px; }
  .detail { padding: 24px; }
  .detail h2 { margin-bottom: 16px; }
  .fields { display: grid; gap: 0; margin: 0; }
  .fields > div { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--lfc-glass-border, #51474e); }
  .fields > div:last-child { border: 0; }
  dt { color: var(--md-sys-color-on-surface-variant, #bbc); font-size: 12px; }
  dd { margin: 0; min-width: 0; overflow-wrap: anywhere; font-size: 13px; }
  pre { margin: 0; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.7; }
  .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .metric { padding: 20px; }
  .metric strong { display: block; margin-top: 10px; font-size: 22px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  @media (max-width: 700px) {
    main { padding: 20px 12px; gap: 16px; }
    .toolbar, footer { padding: 12px; }
    th, td { padding: 14px 12px; }
    .optional { display: none; }
    .row-hash { max-width: 13ch; }
    .fields > div { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
    dt { grid-column: 1 / -1; }
    .detail, .metric { padding: 16px; }
    .metrics { grid-template-columns: 1fr; }
    input { width: 100%; }
  }
`
