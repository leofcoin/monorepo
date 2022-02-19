
import './../elements/double-asset'

export default customElements.define('learn-more-view', class LearnMoreView extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = `
      <style>
        * {
          user-select: none;
          pointer-events: none;
          font-family: 'Noto Sans', sans-serif;
        }
        :host {
          position: relative;
          height: 100%;
          overflow-y: auto;
          flex-direction: column;
          align-items: center;
          display: flex;
          padding: 48px 24px 24px;
          box-sizing: border-box;
          background: var(--secondary-background-color);
          color: var(--secondary-accent-color);
          pointer-events: auto !important;
          --svg-icon-color: var(--secondary-accent-color);
        }

        custom-svg-icon {
        }

        h3 {
          text-transform: uppercase;
          margin: 0;
          font-size: 18px;
        }

        p {
          margin: 0;
        }
        summary flex-row {
          align-items: center;
        }

        a {
          border-radius: 12px 24px;
          padding: 12px 24px;
          box-sizing: border-box;
          text-decoration: none;
          color: var(--main-accent-color);
          background: var(--secondary-accent-color);
          cursor: pointer;
          pointer-events: auto;
        }

        a:first-child {
          color: var(--secondary-accent-color);
          background: var(--main-accent-color);
        }

        flex-row {
          align-items: center;
          padding-bottom: 24px;
          max-width: 300px;
        }

        flex-column {

          padding-left: 12px;
          box-sizing: border-box;
        }

        @media (min-width: 1200px) {
          double-asset-element {
            max-width: 680px;
          }
          :host {
            flex-direction: row;
            align-items: center;
            justify-content: center;
            --svg-icon-size: 56px;
          }
          flex-row {
            max-width: 680px;
          }
          h3 {
            font-size: 32px;
          }
        }
      </style>

      <flex-two></flex-two>
      <double-asset-element src="https://assets.artonline.site/city.webp"></double-asset-element>

      <flex-one></flex-one>
      <summary>
        <flex-row>
          <custom-svg-icon icon="benefits::gear"></custom-svg-icon>
          <flex-column>
            <h3>full experience</h3>
            <p>Experience mining without the drawbacks.</p>
          </flex-column>
        </flex-row>

        <flex-row>
          <custom-svg-icon icon="benefits::plug"></custom-svg-icon>
          <flex-column>
            <h3>no (real) electricity costs</h3>
            <p>Mining without the massive electricity bills.</p>
          </flex-column>
        </flex-row>

        <flex-row>
          <custom-svg-icon icon="benefits::market"></custom-svg-icon>
          <flex-column>
            <h3>market place</h3>
            <p>Trade any ERC1155 or ERC721 NFT on our exchange.</p>
          </flex-column>
        </flex-row>

        <flex-row>
          <custom-svg-icon icon="benefits::money"></custom-svg-icon>
          <flex-column>
            <h3>passive income</h3>
            <p>Buy graphic cards and put them to work, stake the rewards and earn even more!</p>
          </flex-column>
        </flex-row>

      </summary>

      <flex-two></flex-two>
    `
  }
})
