import { CSSResultGroup, LitElement, css, html } from 'lit'
import { property } from 'lit/decorators.js'
import '@vandeurenglenn/lite-elements/typography.js'
import './leofcoin-mark.js'
export class HeroElement extends LitElement {
  @property()
  accessor headline

  @property()
  accessor subline
  @property({ type: Boolean })
  accessor brand = false
  static styles?: CSSResultGroup = [
    css`
      :host {
        background: var(--md-sys-color-surface-container-high);
        color: var(--md-sys-color-on-surface-container-high);
        border-radius: 24px;
        box-sizing: border-box;
        padding: 12px 24px;
        height: 100%;
        max-height: 270px;
        max-width: 320px;
        width: 100%;
        border: 1px solid var(--md-sys-color-outline);
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      h5 {
        margin: 0;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        align-self: stretch;
        margin: 0 0 20px;
      }
      .brand-mark {
        width: 48px;
        height: 48px;
        flex: 0 0 48px;
        box-sizing: border-box;
        padding: 6px;
        border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 32%, transparent);
        border-radius: 16px;
        background: color-mix(in srgb, var(--md-sys-color-primary) 14%, var(--md-sys-color-surface-container-high));
        color: var(--md-sys-color-primary);
      }
      .brand-name {
        display: block;
        color: var(--md-sys-color-on-surface);
        font-size: 17px;
        font-weight: 750;
        letter-spacing: -.02em;
      }
      .brand-slogan {
        display: block;
        color: var(--md-sys-color-primary);
        font-size: 11px;
        font-weight: 650;
        letter-spacing: .04em;
      }
      .tagline {
        width: 100%;
        height: 3px;
        margin: 0 0 18px;
        border: 0;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--md-sys-color-primary), var(--md-sys-color-tertiary), transparent);
      }
    `
  ]
  protected render() {
    return html`
      ${this.brand
        ? html`<div class="brand">
            <leofcoin-mark class="brand-mark" aria-hidden="true"></leofcoin-mark>
            <div>
              <span class="brand-name">Leofcoin</span>
              <span class="brand-slogan">Connected to the world</span>
            </div>
          </div>
          <div class="tagline" aria-hidden="true"></div>`
        : ''}
      <custom-typography type="headline" size="small"><span>${this.headline}</span></custom-typography>
      ${this.subline ? html`<custom-typography type="subline" size="medium">${this.subline}</custom-typography>` : ''}
      <custom-typography type="body" size="medium"><slot></slot></custom-typography>
    `
  }
}

if (!customElements.get('hero-element')) customElements.define('hero-element', HeroElement)
