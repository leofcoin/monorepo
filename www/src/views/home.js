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

        .member {
          display: flex;
          flex-direction: column;
          text-decoration: none;
          cursor: pointer;
          align-items: center;
          color: #555;
          height: 100%;
          max-height: 286px;
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

        .member p {
          margin: 0;
        }

        .member img {
          width: 100%;
          max-width: 160px;
          height: 100%;
          max-height: 160px;
          border-radius: 24px;
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

      <custom-hero class="hero-1">
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

      <custom-hero>
        <h2>Team</h2>
        <flex-wrap-evenly style="align-items: center;">

            <a href="https://www.linkedin.com/in/glenn-vandeuren-315123100/" class="member">
              <img src="https://media-exp1.licdn.com/dms/image/C5603AQGk48vDebV1QA/profile-displayphoto-shrink_200_200/0/1516981862251?e=1641427200&v=beta&t=D07YmIq2bVSz82VzHDx_KQ2za8zFRB_pOgATC2aMl1s"></img>
              <flex-column style="align-items: center;">
                <h4>Glenn Vandeuren</h4>
                <p>Head Development</p>
                <p>Team Supervisor</p>
              </flex-column>
            </a>

            <a href="https://www.linkedin.com/in/jack-daniel-grubba" class="member">
              <img src="https://media-exp1.licdn.com/dms/image/C4D03AQHCIeQkJwi_GA/profile-displayphoto-shrink_200_200/0/1602613270375?e=1641427200&v=beta&t=3FzUW9hPshJhYqbdtgBrK36VxIigZHKGHvaqI5iuTvU"></img>
              <flex-column style="align-items: center;">
                <h4>Jack Daniel Grübba</h4>
                <p>Head Marketing</p>
                <p>NFT Designer</p>
              </flex-column>
            </a>

            <a href="https://www.linkedin.com/in/michael-shakil-829606141" class="member">
              <img src="https://media-exp1.licdn.com/dms/image/C4D03AQE1gsWlW25k7A/profile-displayphoto-shrink_400_400/0/1562178875449?e=1641427200&v=beta&t=B8E03N0BIRVOfa0LeLCDWsjTcMgt1wNtb3IKAfEPzNA"></img>
              <flex-column style="align-items: center;">
                <h4>Michael Shakil</h4>
                <p>Community Manager</p>
                <p>NFT Designer</p>
              </flex-column>
            </a>
        </flex-wrap-evenly>
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
