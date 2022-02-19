import './../elements/custom-hero'
import './../elements/eyedrop'

export default customElements.define('team-view', class TeamView extends HTMLElement {
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
          padding: 48px 24px 24px;
          box-sizing: border-box;
          align-items: center;
          justify-content: center;
          background: var(--main-background-color);
          color: var(--secondary-accent-color);
          --svg-icon-size: 56px;
          --svg-icon-color: var(--secondary-accent-color);
          overflow-y: auto;
        }

        span {
          text-transform: capitalize;
          color: var(--main-accent-color);
        }

        img {
          height: 80px;
          width: 80px;
        }

        flex-wrap-evenly {
          width: 100%;
          height: 100%;
          max-width: 640px;
          pointer-events: auto;
          overflow-y: auto;
        }

        flex-row {
          box-sizing: border-box;
          padding: 24px;
          width: 290px;
        }

        flex-column {
          box-sizing: border-box;
          padding-left: 24px;
        }
      </style>

      <flex-wrap-evenly>
        <flex-row>
          <img src="https://assets.artonline.site/glenn.png">
          <flex-column>
            <strong>Glenn Vandeuren</strong>
            <span>head dev</span>
            <span>CEO</span>
          </flex-column>
        </flex-row>

        <flex-row>
          <img src="https://assets.artonline.site/jack.png">
          <flex-column>
            <strong>Jack Daniels</strong>
            <span>head marketing</span>
            <span>COO</span>
          </flex-column>
        </flex-row>

        <flex-row>
          <img src="https://assets.artonline.site/bhero.png">
          <flex-column>
            <strong>Bhero</strong>
            <span>head UI</span>
            <span>head UX</span>
          </flex-column>
        </flex-row>

        <flex-row>
          <img src="https://assets.artonline.site/john.png">
          <flex-column>
            <strong>John Snow</strong>
            <span>Moderator</span>
          </flex-column>
        </flex-row>

        <flex-row>
          <img src="https://assets.artonline.site/adam.png">
          <flex-column>
            <strong>Adam</strong>
            <span>Moderator</span>
            <span>Code Breaker</span>
          </flex-column>
        </flex-row>

        <flex-row>
          <img src="https://assets.artonline.site/mike.png">
          <flex-column>
            <strong>Mike</strong>
            <span>Marketing</span>
            <span>Moderator</span>
          </flex-column>
        </flex-row>

        <flex-row>
          <img src="https://assets.artonline.site/tears.png">
          <flex-column>
            <strong>Tears</strong>
            <span>Marketing master</span>
          </flex-column>
        </flex-row>

        <flex-row>
          <img src="https://assets.artonline.site/yorick.png">
          <flex-column>
            <strong>Yorick</strong>
            <span>Head Socials</span>
            <span>Moderator</span>
          </flex-column>
        </flex-row>

        <flex-row>
          <img src="https://assets.artonline.site/kyle.png">
          <flex-column>
            <strong>Kyle</strong>
            <span>Socials expert</span>
            <span>Moderator</span>
          </flex-column>
        </flex-row>
      </flex-wrap-evenly>
    `
  }
})
