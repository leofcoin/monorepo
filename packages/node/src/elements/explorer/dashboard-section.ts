import { LiteElement, html, css, property, map } from '@vandeurenglenn/lite'
import '@vandeurenglenn/lite-elements/icon.js'
export class ExplorerDashboardSection extends LiteElement {
  static styles = [
    css`
      :host {
        --chart-blue: var(--lfc-action, #1d64d8);
        --chart-teal: #2fd6c3;
        display: block;
        box-sizing: border-box;
        padding: 24px;
        margin-bottom: 12px;
        width: 100%;
        max-width: 1200px;
      }

      .sections {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 28px 16px;
      }

      .section {
        min-width: 0;
      }

      .section.wide {
        grid-column: 1 / -1;
      }

      .container {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .wide .container {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .item {
        position: relative;
        box-sizing: border-box;
        border: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 60%, transparent);
        border-radius: 18px;
        background: color-mix(in srgb, var(--md-sys-color-surface-container, #1d2230) 88%, transparent);
        color: var(--md-sys-color-on-surface);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        min-height: 112px;
        overflow: hidden;
        transition: border-color 0.2s ease, background 0.2s ease;
      }

      .item:hover {
        border-color: color-mix(in srgb, var(--chart-blue) 55%, transparent);
      }

      .item::after {
        content: '';
        position: absolute;
        inset: auto 20px 0;
        height: 3px;
        border-radius: 3px 3px 0 0;
        background: linear-gradient(90deg, var(--chart-blue), var(--chart-teal));
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.35s ease;
      }

      .item:hover::after {
        transform: scaleX(1);
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
        font-size: 28px;
        font-weight: 700;
        color: var(--md-sys-color-on-surface);
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
        overflow-wrap: anywhere;
      }

      .wide .item > span {
        font-size: 16px;
      }

      .unit {
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        color: var(--md-sys-color-on-surface-variant);
      }

      .item-header {
        display: flex;
        align-items: center;
        gap: 12px;
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

      .item-logo custom-icon {
        --custom-icon-size: 20px;
        --custom-icon-color: var(--md-sys-color-on-primary-container);
      }

      h5 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--md-sys-color-on-surface);
      }

      h4 {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 600;
        color: var(--md-sys-color-on-surface);
      }

      .section-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      }

      .hint {
        margin: 12px 2px 0;
        color: var(--md-sys-color-on-surface-variant);
        font-size: 12px;
        line-height: 1.5;
      }

      @media (max-width: 900px) {
        .wide .container { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 600px) {
        :host { padding: 16px 12px; }
        .sections { grid-template-columns: minmax(0, 1fr); gap: 24px; }
      }

      @media (max-width: 480px) {
        .wide .container { grid-template-columns: minmax(0, 1fr); }
      }

      @media (max-width: 360px) {
        .container, .wide .container { grid-template-columns: minmax(0, 1fr); }
      }

      @media (prefers-reduced-motion: reduce) {
        .item, .item::after { transition: none; }
      }
    `
  ]

  @property({ type: String }) accessor title = ''
  @property({ type: Array }) accessor items: {
    title: string
    icon?: string
    img?: string
    wide?: boolean
    hint?: string
    items: { title: string; value: string | number; icon?: string; unit?: string; exact?: string }[]
  }[] = []
  @property({ type: Boolean }) accessor showIcons = true

  render() {
    return html` ${this.title ? html`<h4>${this.title}</h4>` : ''}

      <div class="sections">
        ${map(
          this.items,
          (item) => html`
            <section class=${item.wide ? 'section wide' : 'section'}>
              <div class="section-heading">
                ${item.img ? html`<span class="item-logo"><img src="${item.img}" alt="${item.title}" /></span>` : ''}
                ${item.icon ? html`<div class="item-logo"><custom-icon .icon=${item.icon}></custom-icon></div>` : ''}
                ${item.title ? html`<h5>${item.title}</h5>` : ''}
              </div>
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
                            <span title=${subItem.exact ?? String(subItem.value)} aria-label=${subItem.exact ?? String(subItem.value)}>${subItem.value}${subItem.unit ? html` <small class="unit">${subItem.unit}</small>` : ''}</span>
                          `
                        : html`
                            <strong>${subItem.title}</strong>
                            <span title=${subItem.exact ?? String(subItem.value)} aria-label=${subItem.exact ?? String(subItem.value)}>${subItem.value}${subItem.unit ? html` <small class="unit">${subItem.unit}</small>` : ''}</span>
                          `}
                    </div>
                  `
                )}
              </div>
              ${item.hint ? html`<p class="hint">${item.hint}</p>` : ''}
            </section>
          `
        )}
      </div>`
  }
}

customElements.define('explorer-dashboard-section', ExplorerDashboardSection)
