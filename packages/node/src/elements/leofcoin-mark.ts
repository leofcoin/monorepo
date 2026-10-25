import { LitElement, css, html } from 'lit'

export class LeofcoinMark extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: inherit;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
  `

  render() {
    return html`
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="lfc-stroke" x1="10" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#5aa2ff" />
            <stop offset="1" stop-color="#2fd6c3" />
          </linearGradient>
        </defs>
        <path d="M12 7v23a9 9 0 0 0 9 9h17" stroke="url(#lfc-stroke)" stroke-width="8" stroke-linecap="round" />
        <path d="M22 29c1.6-9.4 7-14.6 14-15.6" stroke="#2fd6c3" stroke-opacity=".6" stroke-width="2.6" stroke-linecap="round" />
        <circle cx="37" cy="13" r="5" fill="#2fd6c3" />
      </svg>
    `
  }
}

if (!customElements.get('leofcoin-mark')) customElements.define('leofcoin-mark', LeofcoinMark)
