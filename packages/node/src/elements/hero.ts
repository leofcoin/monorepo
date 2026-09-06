import { CSSResultGroup, LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import '@vandeurenglenn/lite-elements/typography.js'
@customElement('hero-element')
export class HeroElement extends LitElement {
  @property()
  accessor headline

  @property()
  accessor subline
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
    `
  ]
  protected render() {
    return html`
      <custom-typography type="headline" size="small"><span>${this.headline}</span></custom-typography>
      ${this.subline ? html`<custom-typography type="subline" size="medium">${this.subline}</custom-typography>` : ''}
      <custom-typography type="body" size="medium"><slot></slot></custom-typography>
    `
  }
}
