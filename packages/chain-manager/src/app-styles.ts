import { css } from 'lit'

export const appStyles = css`
  :host { display: block; min-height: 100vh; color: #edf0f3; font: 15px/1.55 system-ui, sans-serif; }
  * { box-sizing: border-box; }
  button, input, textarea, select { font: inherit; }
  button, a, input, textarea, select, summary { -webkit-tap-highlight-color: transparent; }
  :focus-visible { outline: 3px solid #b6dc9a; outline-offset: 4px; }
  button { cursor: pointer; border: 1px solid #40464e; background: #22272e; color: #edf0f3; border-radius: 8px; padding: 10px 16px; font-weight: 650; min-height: 44px; transition: background .15s; }
  button:hover:not(:disabled) { background: #333a43; }
  button:active:not(:disabled) { background: #414a55; }
  button:disabled { opacity: .45; cursor: not-allowed; }
  button.primary { background: #d3edbc; border-color: #d3edbc; color: #162211; }
  button.primary:hover:not(:disabled) { background: #e4f6d5; }
  button.danger { color: #ffb6b2; }
  button.quiet { background: transparent; }
  .shell { display: grid; grid-template-columns: 224px minmax(0, 1fr); min-height: 100vh; }
  aside { padding: 32px 18px; border-right: 1px solid #2b3037; background: #111418; display: flex; flex-direction: column; gap: 36px; }
  .brand { padding: 0 12px; font-size: 18px; font-weight: 800; line-height: 1.2; letter-spacing: -.6px; }
  .brand span { display: block; color: #a1a9b4; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 9px; font-weight: 550; }
  nav { display: flex; flex-direction: column; gap: 6px; }
  nav button { background: transparent; text-align: left; border-color: transparent; color: #aeb6c1; padding: 11px 14px; }
  nav button[aria-current="page"] { background: #272f26; color: #d3edbc; border-color: #384333; }
  .sidebar-note { margin-top: auto; padding: 0 12px; font-size: 12px; color: #9ba4af; }
  main { min-width: 0; padding: 0 40px 64px; max-width: 1500px; width: 100%; margin: auto; }
  .topbar { min-height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid #2b3037; margin-bottom: 36px; flex-wrap: wrap; padding: 18px 0; }
  .connection { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; min-width: 0; }
  .connection strong { overflow-wrap: anywhere; }
  .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
  .eyebrow { margin: 0 0 8px; color: #b5bfcb; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; }
  h1 { font-size: clamp(30px, 4vw, 48px); letter-spacing: -1.8px; line-height: 1.1; margin: 0 0 14px; font-weight: 780; }
  h2 { font-size: 20px; letter-spacing: -.5px; margin: 0 0 10px; }
  h3 { font-size: 16px; margin: 0 0 8px; }
  p { margin: 0 0 16px; }
  .muted, .help { color: #abb4c0; }
  .help { font-size: 13px; margin: 0; }
  .intro { max-width: 720px; margin-bottom: 30px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
  .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
  .panel { padding: 24px; background: #171b20; border: 1px solid #30363e; border-radius: 12px; min-width: 0; }
  .stack { display: grid; gap: 20px; }
  .metric { margin: 10px 0 0; font-size: 28px; font-weight: 720; letter-spacing: -.8px; overflow-wrap: anywhere; }
  .badge { display: inline-flex; align-items: center; border: 1px solid #46503e; background: #242e21; color: #d3edbc; border-radius: 5px; padding: 3px 8px; font-size: 11px; font-weight: 750; letter-spacing: .5px; text-transform: uppercase; white-space: nowrap; }
  .badge.neutral { color: #c2cad5; background: #22272e; border-color: #404852; }
  .badge.warn { color: #f2d59a; background: #30291d; border-color: #655133; }
  .badge.failed { color: #ffb6b2; background: #332024; border-color: #6d3c40; }
  .banner { padding: 16px 20px; border: 1px solid #46503e; border-left: 3px solid #b6dc9a; background: #1b251b; border-radius: 8px; margin-bottom: 20px; overflow-wrap: anywhere; }
  .banner.error { background: #2b1c20; border-color: #714346; border-left-color: #ffb6b2; }
  .banner.warning { background: #29251b; border-color: #5d5035; border-left-color: #e2c181; }
  .banner p:last-child { margin-bottom: 0; }
  form { display: grid; gap: 18px; }
  label { display: grid; gap: 7px; font-weight: 600; font-size: 14px; }
  input, textarea, select { width: 100%; min-width: 0; color: #f0f2f5; background: #101318; border: 1px solid #4a525e; border-radius: 7px; padding: 11px 12px; min-height: 46px; }
  input::placeholder, textarea::placeholder { color: #87919f; opacity: 1; }
  textarea { resize: vertical; min-height: 110px; }
  textarea.code { min-height: 260px; }
  .mono, code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; }
  .check { display: flex; align-items: flex-start; gap: 10px; font-weight: 450; }
  .check input { width: 18px; height: 18px; min-height: 0; flex: 0 0 18px; margin: 3px 0 0; accent-color: #b6dc9a; }
  fieldset { border: 0; padding: 0; margin: 0; min-width: 0; display: grid; gap: 18px; }
  legend { font-weight: 700; margin-bottom: 14px; }
  dl { margin: 18px 0 0; }
  dl > div { padding: 12px 0; border-top: 1px solid #30363e; display: grid; grid-template-columns: 135px minmax(0, 1fr); gap: 14px; }
  dt { color: #abb4c0; font-size: 13px; }
  dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
  .empty { padding: 36px 24px; border: 1px dashed #49515b; border-radius: 12px; text-align: center; }
  .empty p { max-width: 510px; margin-left: auto; margin-right: auto; }
  .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
  .profile + .profile, .activity + .activity { border-top: 1px solid #3b424c; margin-top: 24px; padding-top: 24px; }
  .profile .actions { margin-top: 16px; }
  .review { border-color: #8b9e7b; margin-bottom: 28px; }
  .review h2 { font-size: 25px; }
  .review form { margin-top: 24px; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #101318; padding: 16px; border-radius: 8px; max-height: 400px; overflow: auto; }
  details { margin-top: 18px; }
  summary { cursor: pointer; color: #d3edbc; padding: 5px 0; }
  manager-view { display: block; min-width: 0; }
  .planner { min-width: 0; }
  @media (min-width: 1100px) { aside { position: sticky; top: 0; height: 100vh; } }
  @media (max-width: 1100px) {
    .shell { grid-template-columns: 190px minmax(0, 1fr); }
    main { padding-left: 24px; padding-right: 24px; }
    .grid { grid-template-columns: 1fr; }
    .metrics { grid-template-columns: 1fr; }
    .metric { font-size: 26px; }
  }
  @media (max-width: 720px) {
    .shell { display: block; }
    aside { padding: 20px 16px 14px; gap: 22px; border-right: 0; border-bottom: 1px solid #30363e; }
    .brand { padding: 0; }
    .brand span { display: inline; margin-left: 12px; font-size: 10px; letter-spacing: 1px; }
    nav { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
    nav button { text-align: center; padding: 9px 2px; font-size: 12px; min-width: 0; }
    .sidebar-note { display: none; }
    main { padding: 0 16px 40px; }
    .topbar { margin-bottom: 28px; min-height: 76px; }
    .panel { padding: 20px 16px; }
    dl > div { grid-template-columns: 1fr; gap: 5px; }
    .intro { margin-bottom: 24px; }
    h1 { letter-spacing: -1px; }
  }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`
