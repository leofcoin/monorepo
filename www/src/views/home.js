import './../elements/custom-hero'

export default customElements.define('home-view', class HomeView extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow-y: auto;
          pointer-events: auto;
          padding: 0 24px 24px 24px;
          box-sizing: border-box;
          overflow-y: auto;
          pointer-events: auto !important;
        }

        h2, h3 {
          margin: 0;
          padding-bottom: 6px;
        }

        custom-hero {
          max-width: 840px;
          max-height: 680px;
          border-color: aliceblue;
        }

        .hero-1 {
          margin: 0 0 64px 0;
        }

        img {
          max-height: 132px;
          height: 100%;
        }

        flex-row {
          align-items: center;
          flex-direction: column;
        }
        .info.info-2 {
          padding: 0 0 36px 0;
          box-sizing: border-box;
        }

        .info {
          padding: 36px 0 0 0;
          box-sizing: border-box;
        }

        @media (min-width: 440px) {
          img {
            max-height: 256px;
          }
        }

        @media (min-width: 1200px) {

          custom-hero {
            max-width: 840px;
            max-height: 480px;
            border-color: aliceblue;
          }

          .info.info-2 {
            padding: 0 36px 0 0;
            box-sizing: border-box;
          }

          .info {
            padding-left: 36px;
            box-sizing: border-box;
          }

          flex-row {
            flex-direction: row;
          }

          hero-1 {
            margin: 0 0 32px 0;
          }

          img {
            max-height: 300px;
          }
        }
      </style>
      <custom-hero class="hero-1">
        <flex-row style="align-items: center;">
          <img src="./assets/banner.png"></img>

          <flex-column class="info">
            <h2>Advantages</h2>
            <p>Simulated mining (no expensive hardware and electricity costs)</p>
            <p>
              Create passive income by generating ART with your ArtOnline NFT Graphics Cards.
            </p>
            <p>
              Buy/sell ArtOnline NFTs on our market/exchange.
             </p>
          </flex-column>
        </flex-row>
      </custom-hero>

      <custom-hero>
        <flex-row style="align-items: center;">
          <flex-column class="info info-2">
            <h2>Constantly fluctuating</h2>
            <p>
              For every transaction 2% of the total amount sent from wallet A to wallet B is automatically burned, which ensures a constantly fluctuating total supply.
            </p>
            <p>
              ArtOnline NFT GPUS purchased with ART, are automatically burnt.
            </p>
          </flex-column>

          <img src="./assets/banner-2.png"></img>
        </flex-row>
      </custom-hero>
    `
  }

  _onvalue() {
    this._timeout && clearTimeout(this._timeout)

    this._timeout = () => setTimeout(() => {
      const input = this.shadowRoot.querySelector('custom-input')
      this.shadowRoot.querySelector('button').innerHTML = `BUY ${input.value} ART FOR ${Number(input.value) / 43478} BNB`
      this._getPrice(this.shadowRoot.querySelector('custom-input').value)
    }, 200);

    this._timeout()
  }
})
