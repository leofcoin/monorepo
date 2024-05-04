import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('app-shell')
export class AppShell extends LitElement {
  static styles = [
    css`
      :host {
        display: block;
      }

      section {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
    `
  ]

  #requestFunds() {}

  render() {
    return html`
      <main>
        <section>
          <input type="text" placeholder="address" />

          <button @click=${this.#requestFunds}>request funds</button>
        </section>
      </main>
    `
  }
}
