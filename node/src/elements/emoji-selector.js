import emojis from './../../node_modules/emojilib/dist/emoji-en-US.json';
import './../../node_modules/custom-tabs/custom-tab.js';
import './../../node_modules/custom-tabs/custom-tabs.js';
import './../../node_modules/custom-pages/src/custom-pages.js';
import './../../node_modules/custom-svg-icon/src/custom-svg-icon.js';
import lib from '../../node_modules/unicode-emoji-json/data-by-emoji.json'

customElements.define('emo-ji', class EmoJi extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
    <style>
      :host {
        display: flex;
        /* width: 28px; */

        font-size: 24px;
        cursor: pointer;
        align-items:center;
        justify-content: center;
        box-sizin: border-box;
        padding: 4px;
      }
      ::slotted(*), slot {
        pointer-events: none;
      }
    </style>
    <slot></slot>`;
  }
});

export default customElements.define('emoji-selector', class EmojiSelector extends HTMLElement {
  get _pages() {
    return this.shadowRoot.querySelector('custom-pages');
  }
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.render()
    window.emojis = emojis;
  }
  connectedCallback() {
    async function init(self) {
      const emojis = await self._parseEmojis();
      await self._buildPages(emojis);
    }
    this._select = this._select.bind(this)
    this.shadowRoot.querySelector('custom-tabs').addEventListener('selected', this._select)
    this.addEventListener('click', event => {
      const target = event.composedPath()[0]
      if (!this.opened) {
        this.opened = true;
        this.classList.add('opened')
      // } else {
        // this.opened = false;
        // this.classList.remove('opened')
      } else if (target.localName === 'emo-ji') {
        this.opened = false;
        this.dispatchEvent(new CustomEvent('selected', {detail: target.innerHTML}));
        this.classList.remove('opened');
      };
    })

    init(this);
  }

  _parseEmojis() {
    return new Promise((resolve, reject) => {
      this.emojis = {};
      for (const i of Object.keys(emojis)) {
        // exclude _custom & undefined category's
        if (lib[i].group && lib[i].group !== '_custom') {
          this.emojis[lib[i].group] = this.emojis[lib[i].group] || [];

          this.emojis[lib[i].group].push({
            name: lib[i].name,
            keywords: emojis[i],
            char: lib[i].slug,
            emoji: i
          });
        }
      }
      resolve(this.emojis);
    });
  }

  _initPage(category) {
    const page = document.createElement('span');
    page.classList.add('page');
    page.dataset.route = category;
    this._pages.appendChild(page);
    return page;
  }

  _buildPages(emojis) {
    return new Promise((resolve, reject) => {
      for (const category of Object.keys(emojis)) {
        const page = this.querySelector(`span[data-route="${category}"]`) || this._initPage(category);
        for (const emoji of emojis[category]) {
          const el = document.createElement('emo-ji');
          page.appendChild(el)
          requestAnimationFrame(() => {
            el.title = `${emoji.name}\n\n${emoji.keywords}`;
            el.name = emoji.name;
            el.keywords = emoji.keywords;
            el.char = emoji.char;
            el.innerHTML = emoji.emoji;
          })
        }
      }
    });


  }
  _select({detail}) {
    const route = detail.getAttribute('data-route');
    requestAnimationFrame(() => {
      this._pages.select(route);
    })
  }
  render() {
    this.shadowRoot.innerHTML = `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        height: 40px;
        width: 430px;
        border-radius: 20px;

      }
      custom-tab, custom-tabs {
        height: 40px;
        box-sizing: border-box;
        outline: none;
      }
      custom-tab {
        width: 40px;
        width: 40px;
        align-items: center;
        justify-content: center;
        display: flex;
        cursor: pointer;
        pointer-events: auto;
      }
      custom-tabs {
        display: flex;
        justify-content: center
      }
      :host(.opened) {
        height: 480px;
        box-shadow: 0 3px 4px 0 rgba(0, 0, 0, 0.14), 0 1px 8px 0 rgba(0, 0, 0, 0.12), 0 3px 3px -2px rgba(0, 0, 0, 0.4);
      }
      custom-tab.custom-seleced {
        border: none;
      }
      :host(.opened) custom-tab.custom-seleced {
        border: auto;
      }
      custom-pages {
        height: 250px;
      }
      .page {
        display: flex;
        flex-flow: row wrap;
        justify-content: center;
        align-content: space-between;
        overflow-y: auto;
        padding-bottom: 12px;
        box-sizing: border-box;
      }
      custom-svg-icon {
        pointer-events: none;
      }

      emo-ji {
        width: 50px;
        height: 50px;
        font-size: 24px;

      }
    </style>
    <custom-tabs selected="History" id="tabs" tabindex="0" attr-for-seleced="data-route">
      <custom-tab data-route="History" title="History"><custom-svg-icon icon="history"></custom-svg-icon></custom-tab>
      <custom-tab data-route="Smileys & Emotion" title="Smileys & Emotion"><custom-svg-icon icon="mood"></custom-svg-icon></custom-tab>
      <custom-tab data-route="People & Body" title="People & Body"><custom-svg-icon icon="people"></custom-svg-icon></custom-tab>
      <custom-tab data-route="Animals & Nature" title="Animals & Nature"><custom-svg-icon icon="local-florist"></custom-svg-icon></custom-tab>
      <custom-tab data-route="Food & Drink" title="Food & Drink"><custom-svg-icon icon="local-pizza"></custom-svg-icon></custom-tab>
      <custom-tab data-route="Objects" title="Objects"><custom-svg-icon icon="cake"></custom-svg-icon></custom-tab>
      <custom-tab data-route="Activities" title="Activities"><custom-svg-icon icon="directions-walk"></custom-svg-icon></custom-tab>
      <custom-tab data-route="Travel & Places" title="Travel & Places"><custom-svg-icon icon="account-balance"></custom-svg-icon></custom-tab>
      <custom-tab data-route="Symbols" title="Symbols"><custom-svg-icon icon="euro-symbol"></custom-svg-icon></custom-tab>
      <custom-tab data-route="Flags" title="Flags"><custom-svg-icon icon="perm-phone-msg"></custom-svg-icon></custom-tab>
    </custom-tabs>
    <custom-pages attr-for-selected="data-route">
      <span class="page" data-route="history"></span>
    </custom-pages>
    `;
  }
})
