import './../node_modules/@vandeurenglenn/flex-elements/src/flex-elements'
import './sections/home'
import './sections/vision'

export default customElements.define('arteon-shell', class ArteonShell extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }
  connectedCallback() {
    const options = {
      root: document.querySelector('[data-scroll-root]'),
      rootMargin: '0px',
      threshold: 1.0
    }

    const callback = (entries, observer) => {
      entries.forEach(async (entry) => {
        if (!entry.isIntersecting) return;

        if (entry.target.localName === 'home-section') {
          this.shadowRoot.querySelector('header').style.background = 'transparent';
          this.shadowRoot.querySelector('header').style.color = '#eee';
          this.shadowRoot.querySelector('header').style.borderBottom = 'none';
        } else {
          this.shadowRoot.querySelector('header').style.background = '#fff';
          this.shadowRoot.querySelector('header').style.color = '#555';
          this.shadowRoot.querySelector('header').style.borderBottom = '1px solid rgba(0,0,0, 0.12)';
        }
        await this._load(entry.target.nextElementSibling.localName)

        console.log(entry)
      })
    }

    const observer = new IntersectionObserver(callback, options)
    observer.observe(this.shadowRoot.querySelector('home-section'))
    observer.observe(this.shadowRoot.querySelector('vision-section'))
    observer.observe(this.shadowRoot.querySelector('features-section'))
  }

  async _load(tag) {
    if (customElements.get(tag)) return

    await import(`./${tag.split('-')[0]}.js`)
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;

        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        overflow: hidden;
      }

      :host, header, footer, .container {
        display: flex;
        width: 100%;
        -webkit-box-sizing: border-box;
        box-sizing: border-box;
      }

      header {
        height: 74px;
        align-items: center;
        justify-content: center;
        z-index: 100;
        color: #eee;
      }

      footer {
        height: 64px;
        padding: 24px;
        justify-content: center;
        align-items: center;
        position: absolute;
        bottom: 0;
        background: #100d12;
        color: #eee;
        font-size: 18px;
      }

      .container {
        max-width: 1200px;
        align-items: center;
      }

      header .container {
        justify-content: center;
      }

      header a.item {
        display: flex;
        padding: 24px 12px;
        pointer-events: auto;
        text-decoration: none;
        text-transform: uppercase;
        -webkit-box-sizing: border-box;
        box-sizing: border-box;
        width: 100%;
        color: inherit;
        max-width: 126px;
        justify-content: center;
      }

      main {
        height: calc(100% - 64px);
        width: 100%;
        overflow-y: auto;
        position: absolute;
        pointer-events: auto;
      }

      .logo {
        height: 48px;
      }
    </style>
    <header>
      <span class="container">
        <a class="item" href="/#!/about">
          about
        </a>
        <a class="item" href="/#!/roadmap">
          roadmap
        </a>
        <a class="item" href="/#!/info">
          info
        </a>

        <a class="item" href="/">
          <img class="logo" src="./assets/arteon.svg"></img>
        </a>

        <a class="item" href="https://mining.arteon.org/#!/exchange">
          exchange
        </a>

        <a class="item" href="/#!/findus-on">
          resources
        </a>

        <a class="item" href="https://mining.arteon.org">
          launch app
        </a>
      </span>
    </header>

    <main>
      <home-section></home-section>
      <vision-section data-route="about"></vision-section>
      <features-section></features-section>
      <burning-section></burning-section>
      <roadmap-section></roadmap-section>
      <resources-section></resources-section>
    </main>

    <footer>
      <span class="container">
        <span>
          <strong>©</strong> 2021 Arteon, all rights reserved.
        </span>
      </span>
    </footer>
    `
  }
})
