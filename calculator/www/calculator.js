var addresses = async (network = 'ropsten') => {
  const importee = await import(`./addresses/${network}.js`);
  return importee.default
};

customElements.define('custom-select', class customSelect extends HTMLElement {
  static get observedAttributes() {
    return ['selected']
  }

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;


    this._onClick = this._onClick.bind(this);
    this.addEventListener('click', this._onClick);

    this.shadowRoot.querySelector('.expand').addEventListener('click', () => {
        // this.input.addEventListener('sele')
      this.opened = true;
    });
  }


  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) this[name] = newValue;
  }

  _onClick(event) {

    const target = event.composedPath()[0];
    console.log(target);
    if (!target.dataset.route) this.opened = true;
    else {
      this.opened = false;
      const prev = this.querySelector(`[selected]`);
      if (prev) prev.removeAttribute('selected');

      target.setAttribute('selected', '');

      this.selected = target.dataset.route;
    }
  }

  set selected(value) {
    this.setAttribute('selected', value);
    this.shadowRoot.querySelector('.selected').innerHTML = value;
    this.dispatchEvent(new CustomEvent('selected', {detail: value}));
  }

  get selected() {
    return this.getAttribute('selected')
  }

  set opened(value) {
    if (value) {
      this.setAttribute('opened', '');
      document.addEventListener('mouseup', () => this.opened = false);
    } else
      this.removeAttribute('opened');
      document.removeEventListener('mouseup', () => this.opened = false);
  }

  get template() {
    return `<style>
      * {
        pointer-events: none;
        user-select: none;
        outline: none;
      }
      :host {
        position: relative;
        display: flex;
        cursor: pointer;
        padding-left: 12px;
        pointer-events: none;

        --hero-border-radius: 24px;
        --hero-color: #eee;
      }

      .dropdown {
        position: absolute;
        opacity: 0;
        top: 0;
        left: 0;
        min-height: 110px;
        max-height: 240px;
        width: max-content;
        background: #333;
        border: 1px solid rgba(0,0,0,0.5);
        user-select: none;
        overflow: auto;
        z-index: 1001;
        display: flex;
        flex-direction: column;
        padding: 12px;
        box-sizing: border-box;
        outline: none;
        align-items: center;
        background: var(--main-background-color);
        border-color: var(--hero-border-color);
        border-radius: var(--hero-border-radius);
        color: var(--hero-color);
        pointer-events: none;
      }

      :host([right]) .dropdown {
        right: 0;
        left: auto;
      }

      span.row {
        pointer-events: auto;
      }

      ::slotted(*) {
        pointer-events: none !important;
      }
      .expand {
        pointer-events: auto;
        transform: rotate(270deg);
        font-size: 24px;
        font-weight: 800;
      }
      :host([opened]) .dropdown, :host([opened]) ::slotted(*) {
        opacity: 1;
      }
      :host([opened]) .dropdown {
        pointer-events: auto;
      }
      :host([opened]) ::slotted(*) {
        pointer-events: auto !important;
      }
      :host([opened]) .expand, :host([opened]) .selected {
        pointer-events: none !important;
      }

      :host([opened][center]) .dropdown {
        top: 50%;
        left: 50%;
        position: fixed;
        transform: translate(-50%, -50%);
        width: 320px;
        max-height: 480px;
        height: 100%;
        box-sizing: border-box;
      }

      .row {
        display: flex;
        flex-direction: row;
        align-items: center;
        flex: 1;
      }

      .selected {
        padding-right: 12px;
      }

    </style>

    <span class="row">
      <span class="selected" icon></span>
      <span class="expand">&#10096;</span>
    </span>

    <span class="dropdown">
      <slot name="top"></slot>
      <slot></slot>
    </span>`
  }
});

(() => {
  class CustomInput extends HTMLElement {
    static get observedAttributes() {
      return ['placeholder', 'value', 'type', 'autocomplete', 'name'];
    }
    constructor() {
      super();
      this.attachShadow({mode: 'open'});
      this.shadowRoot.innerHTML = this.template;
    }
    set autocomplete(val) {
      this.input.setAttribute('autocomplete', val);
    }
    set name(val) {
      this.input.setAttribute('name', val);
    }
    set type(val) {
      this.input.setAttribute('type', val);
    }
    set placeholder(val) {
      this.input.setAttribute('placeholder', val);
    }
    set value(val) {
      this.input.setAttribute('value', val);
    }
    get autocomplete() {
      return this.input.autocomplete;
    }
    get input() {
      return this.shadowRoot.querySelector('input');
    }
    get value() {
      return this.input.value;
    }
    get name() {
      return this.input.name;
    }
    addListener(name, cb) {
      if(name === 'input' || name === 'change' || name === 'value') {
        this.input.addEventListener(name, cb);
      } else {
        this.addEventListener(name, cb);
      }
    }
    attributeChangedCallback(name, old, value) {
      if (old !== value) this[name] = value;
    }
    get template() {
      return `
        <style>
          :host {
            display: flex;
            align-items: center;
            height: var(--custom-input-height, 48px);
            background: var(--custom-input-background, transparent);
            width: 100%;
            box-shadow: 0px 1px 3px -1px #333;
            min-width: 240px;
            --custom-input-color: #555;
            --custom-input-outline: none;
          }
          input {
            --webkit-visibility: none;
            border: none;
            background: transparent;
            height: var(--custom-input-height, 48px);
            width: 100%;
            box-sizing: border-box;
            padding: 10px;
            color: var(--custom-input-color, #555);
            outline: var(--custom-input-outline);
          }

          ::placeholder {
            color: var(--custom-input-placeholder-color, --custom-input-color);
          }
        </style>
        <slot name="before"></slot>
        <input></input>
        <slot name="after"></slot>
      `;
    }
  }  customElements.define('custom-input', CustomInput);
})();

customElements.define('flex-row', class FlexRow extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
  }
  get template() {
    return `<style>
      :host {
        display: flex;
        flex-direction: row;
      }      
    </style>
    <slot></slot>
    `
  }
});

customElements.define('flex-column', class FlexColumn extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
  }
  get template() {
    return `<style>
      :host {
        display: flex;
        flex-direction: column;
      }      
    </style>
    <slot></slot>
    `
  }
});

customElements.define('flex-one', class FlexOne extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
  }
  get template() {
    return `<style>
      :host {
        flex: 1;
      }
    </style>
    
    <slot></slot>`
  }
});

class Api {
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.onload = () => resolve();
      script.onerror = () => reject();
      script.src = src;
      document.head.appendChild(script);
    });
  }

  get assets() {
    return {
      cards: {
        GENESIS: './assets/cards/GENESIS-320.png',
        'ARTX 1000': './assets/cards/ARTX 1000-320.png',
        'ARTX 2000': './assets/cards/ARTX 2000-320.png',
        'XTREME': './assets/cards/XTREME-320.png'
      },
      fans: {
        GENESIS: './assets/fans/GENESIS.png',
        'ARTX 1000': './assets/fans/ARTX 1000.png',
        'ARTX 2000': './assets/fans/ARTX 2000.png',
        'XTREME': './assets/fans/XTREME.png'
      },
      fronts: {
        'XTREME': './assets/fronts/XTREME.png'
      },
      configs: {
        GENESIS: {
          fans: [
            ['4%', '30%', '76px', '76px'],
            ['35.5%', '30%', '76px', '76px'],
            ['68%', '30%', '76px', '76px']
          ] // x, y, h, w
        },
        'ARTX 1000': {
          fans: [
            ['73.5%', '33%', '48px', '48px'],
          ] // x, y, h, w
        },
        'ARTX 2000': {
          fans: [
            ['25%', '12.5%', '75px', '75px'],
            ['63.3%', '12.5%', '75px', '75px']
          ] // x, y, h, w
        },
        'XTREME': {
          fans: [
            ['12%', '12.5%', '80px', '80px'],
            ['39%', '15%', '75px', '75px', 1],
            ['64.3%', '12.5%', '80px', '80px']
          ], // x, y, h, w, id
          fronts: [
            ['22%', '6%', '76%', '62.5%']
          ]
        }
      }
    }
  }

  get maximumSupply() {
    return {
      GENESIS: 50,
      'ARTX 1000': 450,
      'ARTX 2000': 250,
      'XTREME': 133
    }
  }

  getAssetFor(symbol) {
    return this.assets[symbol]
  }
}

customElements.define('gpu-img', class GpuImg extends HTMLElement {

  static get observedAttributes() {
    return ['symbol']
  }

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
  }

  connectedCallback() {
    if (this.hasAttribute('symbol')) this.symbol = this.getAttribute('symbol');

  }

  attributeChangedCallback(name, old, value) {
    if(value !== old || !this[name]) this[name] = value;
  }

  set symbol(value) {
    this.setAttribute('symbol', value);
    this._observer();
  }

  get symbol() {
    return this.getAttribute('symbol')
  }

  _observer() {
    if (!this.symbol) return;
    this._render();
  }

  async _render(listing, isOwner) {
    this.innerHTML = '';

    this.asset = api.assets.cards[this.symbol];
    this.fanAsset = api.assets.fans[this.symbol];
    this.frontAsset = api.assets.fronts[this.symbol];
    const configs = api.assets.configs[this.symbol];

    for (const [x, y, height, width, id] of configs.fans) {
      const img = document.createElement('img');
      img.setAttribute('slot', 'fan');
      img.src = Boolean(id === undefined) ? this.fanAsset : this.fanAsset.replace('.png', `-${id}.png`);
      img.dataset.id = id;
      img.style.height = height;
      img.style.width = width;
      img.style.top = y;
      img.style.left = x;
      this.appendChild(img);
    }
    if (configs.fronts) {
      const [x, y, height, width] = configs.fronts[0];
      const img = document.createElement('img');
      img.setAttribute('slot', 'front');
      img.src = this.frontAsset;
      img.style.height = height;
      img.style.width = width;
      img.style.top = y;
      img.style.left = x;
      this.appendChild(img);
    }

    this.shadowRoot.innerHTML = this.template;
  }
  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        display: flex;
        position: relative;
        max-height: 129px;
        max-width: 274px;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      }

      .card {
        width: 100%;
        height: 100%;
      }

      slot[name="fan"]::slotted(*), slot[name="front"]::slotted(*) {
        position: absolute;
        margin: 0 !important;
        padding: 0 !important;
      }

      slot[name="fan"]::slotted(*) {
        -webkit-animation: rotation 2s linear infinite;
        -moz-animation: rotation 2s linear infinite;
        -ms-animation: rotation 2s linear infinite;
        -o-animation: rotation 2s linear infinite;
        animation: rotation 2s linear infinite;
      }

      slot[name="fan"]::slotted([data-id="1"]) {
        -webkit-animation: rotationBack 2s linear infinite;
        -moz-animation: rotationBack 2s linear infinite;
        -ms-animation: rotationBack 2s linear infinite;
        -o-animation: rotationBack 2s linear infinite;
        animation: rotationBack 2s linear infinite;
      }

      @media (max-width: 371px) {
        :host, slot[name="fan"]::slotted(*) {
          height: 0 !important;
          width: 0 !important;
        }
      }
    </style>
    <slot name="fan"></slot>
    <slot name="front"></slot>
    <img class="card" src="${this.asset}"></img>

      `
  }
});

var calculator = customElements.define('arteon-calculator', class ArteonCalculator extends HTMLElement {

  get _networkSelect() {
    return this.shadowRoot.querySelector('.network')
  }

  get _gpuSelect() {
    return this.shadowRoot.querySelector('.gpu')
  }

  get _timeSelect() {
    return this.shadowRoot.querySelector('.time')
  }

  get _img() {
    return this.shadowRoot.querySelector('gpu-img')
  }

  get gpus() {
    return this.addresses.cards
  }

  set rewardPerGPU(value) {
    const period = this.timeInput.value; // returns minutes
    this.timeInput.format; // seconds, minutes, hours, days ...
    const divideOrMultiply = this.timeInput.divideOrMultiply;
    this.shadowRoot.querySelector('.rewards').innerHTML = divideOrMultiply === 'multiply' ? value * period : value / period;
  }

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
    this._onGpuSelected = this._onGpuSelected.bind(this);
  }

  connectedCallback() {
    this._setup();
  }

  async _setup() {
    globalThis.api = new Api();
    this.addresses = await addresses('mainnet');

    for (const key of Object.keys(this.gpus)) {
      const el = document.createElement('span');
      el.innerHTML = key;
      el.dataset.address = this.gpus[key];
      el.dataset.route = key;
      this._gpuSelect.appendChild(el);
    }
    this._gpuSelect.selected = 'GENESIS';
    this._timeSelect.selected = 'day';
    this._img.symbol = 'GENESIS';

    this._gpuSelect.addEventListener('selected', this._onGpuSelected);
  }

  async _onGpuSelected({detail}) {
    this._img.symbol = detail.includes('artx') ?
      detail.replace('artx', 'ARTX ') : detail.toUpperCase();

    this.contract = new ethers.Contract(this.addresses.cards[detail]);
    console.log(event);
  }

  async _getReward() {
    this.rewardPerGPU = await this.contract.callstatic.rewardPerGPU();
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        background: var(--main-background);
        color: var(--main-color);
      }

      .hero {
        padding: 24px;
        box-sizing: border-box;
        max-width: 320px;
        width: 100%;
        align-items: center;
        background: var(--custom-drawer-background);
      }

      flex-row {
        width: 100%;
      }

      custom-input {
        min-width: 160px;
      }

      input {
        background: transparent;
        color: var(--main-color);
        border: none;
      }
    </style>

    <flex-column class="hero">

      <gpu-img></gpu-img>
      <flex-row>
        <h4>gpu</h4>
        <flex-one></flex-one>
        <custom-select class="gpu"></custom-select>
      </flex-row>
      <flex-row>
        <input placeholder="amount" type="number" value="1"></input>
        <span class="format"></span>
        <flex-one></flex-one>

        <custom-select class="time">
          <span data-route="ms">ms(s)</span>
          <span data-route="second">second(s)</span>
          <span data-route="minute">minute(s)</span>
          <span data-route="hour">hour(s)</span>
          <span data-route="day">day(s)</span>
          <span data-route="month">month(s)</span>
          <span data-route="year">year(s)</span>
        </custom-select>
      </flex-row>
    </flex-column>
    `
  }
});

export { calculator as default };
