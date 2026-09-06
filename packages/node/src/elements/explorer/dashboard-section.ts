import { LiteElement, html, css, property, map } from '@vandeurenglenn/lite'
import '@vandeurenglenn/lite-elements/icon.js'
import '@vandeurenglenn/flex-elements/wrap-between.js'
export class ExplorerDashboardSection extends LiteElement {
  static styles = [
    css`
      :host {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        padding: 24px;
        gap: 24px;
        margin-bottom: 12px;
        width: 100%;
        max-width: 1200px;
      }

      h2 {
        margin: 0 0 16px 0;
        font-size: 28px;
        font-weight: 600;
        color: var(--md-sys-color-on-surface);
      }

      .container {
        display: flex;
        flex-direction: column;
        flex-flow: row wrap;
        gap: 16px;
        width: 100%;
      }

      .item {
        box-sizing: border-box;
        border: none;
        border-radius: 12px;
        background: var(--md-sys-color-inverse-on-surface);
        color: var(--md-sys-color-on-surface);
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 140px;
      }

      .item:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
      }

      .item strong {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--md-sys-color-on-surface-variant);
        margin: 0;
      }

      .item > span {
        font-size: 20px;
        font-weight: 700;
        color: var(--md-sys-color-primary);
      }

      .item-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }

      .item-logo {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--md-sys-color-primary-container);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .item-logo img {
        width: 20px;
        height: 20px;
      }

      .item-logo custom-svg-icon {
        --icon-size: 20px;
        --icon-color: var(--md-sys-color-on-primary-container);
      }

      h5 {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 500;
        color: var(--md-sys-color-on-surface-variant);
      }

      h4 {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 600;
        color: var(--md-sys-color-on-surface);
      }

      flex-column {
        gap: 16px;
        width: auto;
        padding-bottom: 36px;
      }

      flex-row {
        align-items: center;
        gap: 8px;
      }

      flex-row h5 {
        margin: 0;
      }

      .item {
        width: calc(100% / 2 - 8px);
      }

      flex-column {
        width: 100%;
      }

      @media (min-width: 770px) {
        .item {
          width: calc(100% / 3 - 16px);
        }
        flex-column {
          width: 100%;
        }
      }

      @media (min-width: 1300px) {
        .item {
          width: calc(100% / 2 - 8px);
        }
        flex-column {
          width: calc(100% / 2 - 8px);
        }
      }
    `
  ]

  @property({ type: String }) accessor title = ''
  @property({ type: Array }) accessor items: {
    title: string
    items: { title: string; value: string; icon?: string }[]
  }[]
  @property({ type: Boolean }) accessor showIcons = true

  render() {
    return html` ${this.title ? html`<h4>${this.title}</h4>` : ''}

      <flex-wrap-between>
        ${map(
          this.items,
          (item) => html`
            <flex-column>
              <flex-row>
                ${item.img ? html`<span class="item-logo"><img src="${item.img}" alt="${item.title}" /></span>` : ''}
                ${item.icon ? html`<div class="item-logo"><custom-icon .icon=${item.icon}></custom-icon></div>` : ''}
                ${item.title ? html`<h5>${item.title}</h5>` : ''}
              </flex-row>
              <div class="container">
                ${map(
                  item.items,
                  (subItem) => html`
                    <div class="item">
                      ${this.showIcons && subItem.icon
                        ? html`
                            <div class="item-header">
                              <div class="item-logo">
                                <custom-icon .icon=${subItem.icon}></custom-icon>
                              </div>
                              <strong>${subItem.title}</strong>
                            </div>
                            <span>${subItem.value}</span>
                          `
                        : html`
                            <strong>${subItem.title}</strong>
                            <span>${subItem.value}</span>
                          `}
                    </div>
                  `
                )}
              </div></flex-column
            >
          `
        )}
      </flex-wrap-between>`
  }
}

customElements.define('explorer-dashboard-section', ExplorerDashboardSection)
