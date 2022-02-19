export default customElements.define('faucet-view', class extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  get template() {
    return `
    <style>
      * {
        pointer-events: auto;
      }
      :host {
        display: flex;
        flex-direction: row;
        width: 100%;
        height: 100%;
        justify-content: flex-end;
        color: var(--secondary-accent-color);
        font-weight: 400;
      }
      h2 {
        margin-top: 0;
        font-size: 2.5em;
      }
      .h2_accent {
        color: var(--accent-color);
      }
      .container {
        display: flex;
        width: 100%;
        padding: 4em 0;
        box-sizing: border;
      }
      .content {
        width: 70%;
        padding-left: 5em;
      }
      .paper-wallet {
        width: 100%;
      }
      img {
        width: 100%;
      }
      @media (max-width: 1200px) {
        :host {
          justify-content: center;
        }
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          height: 100%;
          width: 90%;
          padding-top: 0em;
        }
        .content {
          width: 100%;
          padding: 1em 0;
        }
        .pw {
          max-width: 100%;
        }
      }
      @media (max-width: 1200px) {
        h2, p {
          text-align: left;
        }
        p {
          padding: 0 16em;
        }
      }
      @media (max-width: 900px) {
        p {
          padding: 0 9em;
        }
      }
      @media (max-width: 600px) {
        p {
          padding: 0;
        }
      }
      a {
        text-decoration: none;
        background: var(--main-accent-color);
        border: none;
        border-radius: 12px;
        color: var(--secondary-accent-color);
        box-sizing: border-box;
        padding: 12px 24px;
      }
    </style>
    <span class="container">
      <span class="content">
        <h2>ArtOnline <span class="h2_accent">faucet</span></h2>
        <p>Our official faucet to get some TART!</p>
        <a href="https://faucet.artonline.site">go to faucet</a>
      </span>
      <span class="paper-wallet">
        <img class="pw" src="https://assets.artonline.site/faucet.png" alt="preview of Artonline\'s faucet">
      </span>

    </span>
    `
  }
})
