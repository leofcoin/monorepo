import './../elements/custom-hero'
import './../elements/double-asset'

export default customElements.define('home-view', class HomeView extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = `
      <style>
        * {
          user-select: none;
          pointer-events: none;
        }
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow-y: auto;
          pointer-events: auto;
          padding: 0 24px 24px 24px;
          box-sizing: border-box;
          overflow-y: auto;
          pointer-events: auto !important;
          background: var(--main-background-color);
          font-family: 'Noto Sans', sans-serif;
          color: var(--secondary-accent-color);
        }

        h1 {
          margin: 0;
          font-size: 44px;
        }

        h2 {
          font-size: 40px;
        }

        [icon="backgrounds::wave"] {
          position: absolute;
          width: 100%;
          height: auto;
          max-height: 312px;
          bottom: 0;
          left: 0;
          right: 0;
        }

        img.gpus {
          /* height: auto; */
          /* max-height: 386px; */
          width: auto;
          /* position: absolute;
          right: 24%;
          top: 23%; */
        }

        [icon="eyedrop::1"], [icon="eyedrop::2"], [icon="eyedrop::3"] {
          /* position: absolute; */
          width: 100%;
          max-width: 700px;
          height: 100%;
          max-height: 496px;
          /* right: 18%;
          top: 18%; */
        }

        summary {
          /* position: absolute;
          left: 26%;
          top: 34%; */
        }

        summary flex-row {
          align-items: center;
        }

        .logo {
          height: 64px;
          padding-right: 12px;
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

        flex-column {
          align-items: center;
          height: 100%;
          width: 100%;
        }

        @media (min-width: 1200px) {
          double-asset-element {
            max-width: 680px;
          }
          flex-column {
            flex-direction: row;
          }
        }
      </style>
      <flex-column>
        <flex-two></flex-two>
        <summary>
          <flex-row>
            <img class="logo" src="https://assets.artonline.site/arteon.svg" alt="ArtOnline"  title="ArtOnline"></img>
            <h1>ArtOnline</h1>
          </flex-row>
          <h2>Mine, Trade, Earn, Play.</h2>

          <flex-row>
            <a href="#!/products">services</a>
            <flex-one></flex-one>
            <a href="#!/whitepaper">whitepaper</a>
            <flex-four></flex-four>
          </flex-row>
        </summary>

        <flex-one></flex-one>
        <double-asset-element src="https://assets.artonline.site/gpus.webp"></double-asset-element>
        <flex-two></flex-two>
        <!-- <img class="gpus" src="https://assets.artonline.site/gpus.webp"></img> -->

      </flex-column>
      <custom-svg-icon icon="backgrounds::wave"></custom-svg-icon>
    `
  }
})
