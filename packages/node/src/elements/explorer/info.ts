import { html, css, LiteElement, map, property } from '@vandeurenglenn/lite'

export default customElements.define(
  'explorer-info',
  class ExplorerInfo extends LiteElement {
    @property({ type: String, attribute: 'title' }) accessor title: string

    @property({ type: Array }) accessor items: { title: string; value: string }[]

    static styles = [
      css`
        :host {
          display: flex;
          flex-direction: column;

          box-sizing: border-box;
          max-width: 600px;
          max-height: 480px;
          width: 100%;
          height: 100%;
          padding: 12px;
        }

        flex-row {
          width: 100%;
          align-items: center;
          justify-content: center;
        }

        h4 {
          margin: 0;
        }

        .title-container {
          border-bottom: 1px solid var(--border-color);

          box-sizing: border-box;
          padding: 6px 12px;
        }
        .content-container {
          box-sizing: border-box;
          padding: 12px;
          background: var(--md-sys-color-secondary-container);
          color: var(--md-sys-color-on-secondary-container);
          border: 1px solid var(--border-color);
          border-radius: var(--md-sys-shape-corner-medium);
        }
      `
    ]

    render() {
      return html`
        <flex-column class="title-container">
          <h4>${this.title}</h4>
        </flex-column>
        <flex-one></flex-one>

        <flex-column class="content-container">
          ${map(
            this.items,
            (item) => html`
              <flex-row>
                <span>${item.title}</span>
                <flex-it></flex-it>
                <strong>${item.value}</strong>
              </flex-row>
            `
          )}
        </flex-column>
      `
    }
  }
)
