export default customElements.define('vision-section', class VisionSection extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        position: relative;
        width: 100%;
        align-items: center;
        justify-content: center;
        height: 668px;
        box-sizing: border-box;
        padding: 24px;
      }

      flex-column {
      }

      flex-row {
        max-width: 1200px;
        width: 100%;
        box-sizing: border-box;
        padding-top: 24px;
        align-items: flex-end;
      }

      h2, h3, h4 {
        line-height: 1em;
        font-weight: 700;
        text-transform: uppercase;
        color: #fff;
        margin: 0;
        -ms-word-wrap: break-word;
        word-wrap: break-word;
      }

      h2 {
        color: #d70d96;
        font-size: 60px;
        letter-spacing: -.02em;
      }

      h4 {
        color: #431a79;
        font-size: 25px;
        letter-spacing: -0.6px;
      }

      button {
        cursor: pointer;
        color: #eee;
        background: #d70d96;
        border: 1px solid transparent;
        padding: 16px 24px;
        min-width: 240px;
        pointer-events: auto;
        -webkit-clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px));
        clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px));
      }

    </style>
    <h2>THE ARTEON VISION</h2>
    <h4>INTRODUCING THE WORLD OF VIRTUAL MINING!</h4>

    <flex-row>
      <img src="assets/ArteonGPUS-1-600.png" loading="lazy"></img>
      <flex-column>
        <h4>The advantages without the disadvantages of mining</h4>

        <p>
          By using ERC721 non fungible tokens (Arteon Graphics Cards) we want to simulate the real mining world but without the necessary expensive hardware and large electricity costs, and create a market of Arteon NFTs.
        </p>

        <p>
          Create passive income by generating Arteon with your Arteon Graphics Cards NFTs just like Bitcoin miners do.
        </p>

        <p>
          From time to time new versions of Arteon Graphics Cards will be released and will be available on OpenSea, sell your old Arteon Graphics Card on the OpenSea market to buy a new one or keep your old one and combine it with a new Arteon Graphics Card, the possibilities are endless!
        </p>

        <flex-row>
          <button>buy gpu</button>
          <flex-one></flex-one>
          <button>full explanation</button>
        </flex-row>
      </flex-column>
    </flex-row>

    `
  }
})
