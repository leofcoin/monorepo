import './../elements/custom-hero'
import './../elements/eyedrop'

export default customElements.define('links-view', class LinksView extends HTMLElement {
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
          display: flex;
          padding: 24px;
          box-sizing: border-box;
          align-items: center;
          justify-content: center;
          background: var(--main-background-color);
          color: var(--secondary-accent-color);
          --svg-icon-size: 56px;
          --svg-icon-color: var(--secondary-accent-color);
        }

        a {
          display: flex;
          align-items: center;
          color: var(--secondary-accent-color);
          padding-bottom: 24px;
          text-decoration: none;
          pointer-events: auto;
          cursor: pointer;
        }

        img {
          height: 54px;
          width: 54px;
          padding-right: 12px;
        }

      </style>

      <flex-column>
        <a href="https://twitter.com/ArtonlineToken" title="Follow us on Twitter!">
          <img src="https://assets.artonline.site/social/twitter-white.svg"></img>
          <strong>Twitter</strong>
        </a>
        <flex-one></flex-one>
        <a href="https://t.me/ARTEONDEFI" title="Join us on Telegram!">
          <img src="https://assets.artonline.site/social/telegram-white.svg"></img>
          <strong>Telegram</strong>
        </a>
        <flex-one></flex-one>
        <a href="https://discord.gg/aVNexVqE3Z" title="Let's discuss on Discord!">
          <img src="https://assets.artonline.site/social/discord-white.svg"></img>
          <strong>Discord</strong>
        </a>
      </flex-column>
    `
  }
})
