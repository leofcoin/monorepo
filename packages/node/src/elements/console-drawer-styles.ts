import { css } from 'lit'

// Shared by the sync and notification drawers; native dialogs manage focus and Escape.
export const consoleDrawerStyles = css`
  :host { display: contents; color: var(--md-sys-color-on-surface, #eee); }
  dialog {
    position: fixed; inset: 12px 12px 12px auto; margin: 0;
    width: min(440px, calc(100vw - 24px)); height: calc(100dvh - 24px);
    max-width: none; max-height: none; padding: 0; box-sizing: border-box;
    color: inherit; font: inherit; background: var(--md-sys-color-surface-container, #242126);
    border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 24px;
    box-shadow: 0 24px 80px rgb(0 0 0 / 28%);
  }
  dialog[open] { display: flex; flex-direction: column; animation: drawer-enter 180ms ease-out; }
  dialog::backdrop { background: rgb(8 7 10 / 52%); backdrop-filter: blur(3px); }
  header { display: flex; align-items: center; gap: 12px; padding: 24px; border-bottom: 1px solid var(--lfc-glass-border, #51474e); }
  header > div { flex: 1; min-width: 0; }
  h2 { font-size: 24px; letter-spacing: -.035em; margin: 3px 0 0; }
  .eyebrow { color: var(--md-sys-color-primary, #9fc4ff); font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
  p { color: var(--md-sys-color-on-surface-variant, #ccc); font-size: 13px; line-height: 1.6; margin: 6px 0 0; }
  footer { padding: 16px 24px max(16px, env(safe-area-inset-bottom)); border-top: 1px solid var(--lfc-glass-border, #51474e); }
  button, .action {
    font: inherit; font-size: 13px; color: inherit; border: 1px solid var(--lfc-glass-border, #51474e);
    border-radius: 12px; background: transparent; min-height: 44px; padding: 0 14px; cursor: pointer;
  }
  .action { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; box-sizing: border-box; }
  .close { width: 44px; padding: 0; display: grid; place-items: center; flex-shrink: 0; font-size: 22px; }
  button:hover:not(:disabled), .action:hover { background: var(--md-sys-color-surface-container-high, #383139); }
  button:focus-visible, a:focus-visible { outline: 2px solid var(--md-sys-color-primary, #9fc4ff); outline-offset: 3px; }
  button:disabled { opacity: .45; cursor: default; }
  @keyframes drawer-enter { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
  @media (max-width: 639px) {
    dialog { inset: 8px; width: calc(100vw - 16px); height: calc(100dvh - 16px); border-radius: 20px; }
    header { padding: 20px; }
    footer { padding-left: 20px; padding-right: 20px; }
  }
  @media (prefers-reduced-motion: reduce) { dialog[open] { animation: none; } }
`

export function isBackdropClick(event: MouseEvent) {
  if (event.target !== event.currentTarget) return false
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom
}
