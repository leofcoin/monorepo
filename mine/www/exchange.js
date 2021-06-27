import { E as EXCHANGE_ABI } from './exchange-1fd4387f.js';
import { G as GPU_ABI } from './custom-input-bb0a41e0.js';
import { a as elevation4dp, e as elevation2dp } from './elevation-f8af9a6d.js';

(function () {

  /**
   * @mixin Backed
   * @module utils
   * @export merge
   *
   * some-prop -> someProp
   *
   * @param {object} object The object to merge with
   * @param {object} source The object to merge
   * @return {object} merge result
   */
  var merge = (object = {}, source = {}) => {
    // deep assign
    for (const key of Object.keys(object)) {
      if (source[key]) {
        Object.assign(object[key], source[key]);
      }
    }
    // assign the rest
    for (const key of Object.keys(source)) {
      if (!object[key]) {
        object[key] = source[key];
      }
    }
    return object;
  };

  window.Backed = window.Backed || {};
  // binding does it's magic using the propertyStore ...
  window.Backed.PropertyStore = window.Backed.PropertyStore || new Map();

  // TODO: Create & add global observer
  var PropertyMixin = base => {
    return class PropertyMixin extends base {
      static get observedAttributes() {
        return Object.entries(this.properties).map(entry => {if (entry[1].reflect) {return entry[0]} else return null});
      }

      get properties() {
        return customElements.get(this.localName).properties;
      }

      constructor() {
        super();
        if (this.properties) {
          for (const entry of Object.entries(this.properties)) {
            entry[1];
            // allways define property even when renderer is not found.
            this.defineProperty(entry[0], entry[1]);
          }
        }
      }

      connectedCallback() {
        if (super.connectedCallback) super.connectedCallback();
        if (this.attributes)
          for (const attribute of this.attributes) {
            if (String(attribute.name).includes('on-')) {
              const fn = attribute.value;
              const name = attribute.name.replace('on-', '');
              this.addEventListener(String(name), event => {
                let target = event.path[0];
                while (!target.host) {
                  target = target.parentNode;
                }
                if (target.host[fn]) {
                  target.host[fn](event);
                }
              });
            }
        }
      }

      attributeChangedCallback(name, oldValue, newValue) {
        this[name] = newValue;
      }

      /**
       * @param {function} options.observer callback function returns {instance, property, value}
       * @param {boolean} options.reflect when true, reflects value to attribute
       * @param {function} options.render callback function for renderer (example: usage with lit-html, {render: render(html, shadowRoot)})
       */
      defineProperty(property = null, {strict = false, observer, reflect = false, renderer, value}) {
        Object.defineProperty(this, property, {
          set(value) {
            if (value === this[`___${property}`]) return;
            this[`___${property}`] = value;

            if (reflect) {
              if (value) this.setAttribute(property, String(value));
              else this.removeAttribute(property);
            }

            if (observer) {
              if (observer in this) this[observer]();
              else console.warn(`observer::${observer} undefined`);
            }

            if (renderer) {
              const obj = {};
              obj[property] = value;
              if (renderer in this) this.render(obj, this[renderer]);
              else console.warn(`renderer::${renderer} undefined`);
            }

          },
          get() {
            return this[`___${property}`];
          },
          configurable: strict ? false : true
        });
        // check if attribute is defined and update property with it's value
        // else fallback to it's default value (if any)
        const attr = this.getAttribute(property);
        this[property] = attr || this.hasAttribute(property) || value;
      }
    }
  };

  var SelectMixin = base => {
    return class SelectMixin extends PropertyMixin(base) {

      static get properties() {
        return merge(super.properties, {
          selected: {
            value: 0,
            observer: '__selectedObserver__'
          }
        });
      }

      constructor() {
        super();
      }

      get slotted() {
        return this.shadowRoot ? this.shadowRoot.querySelector('slot') : this;
      }

      get _assignedNodes() {
        const nodes = 'assignedNodes' in this.slotted ? this.slotted.assignedNodes() : this.children;
        const arr = [];
        for (var i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.nodeType === 1) arr.push(node);
        }
        return arr;
      }

      /**
      * @return {String}
      */
      get attrForSelected() {
        return this.getAttribute('attr-for-selected') || 'name';
      }

      set attrForSelected(value) {
        this.setAttribute('attr-for-selected', value);
      }

      attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
          // check if value is number
          if (!isNaN(newValue)) {
            newValue = Number(newValue);
          }
          this[name] = newValue;
        }
      }

      /**
       * @param {string|number|HTMLElement} selected
       */
      select(selected) {
        if (selected) this.selected = selected;
        // TODO: fix selectedobservers
        if (this.multi) this.__selectedObserver__();
      }

      next(string) {
        const index = this.getIndexFor(this.currentSelected);
        if (index !== -1 && index >= 0 && this._assignedNodes.length > index &&
            (index + 1) <= this._assignedNodes.length - 1) {
          this.selected = this._assignedNodes[index + 1];
        }
      }

      previous() {
        const index = this.getIndexFor(this.currentSelected);
        if (index !== -1 && index >= 0 && this._assignedNodes.length > index &&
            (index - 1) >= 0) {
          this.selected = this._assignedNodes[index - 1];
        }
      }

      getIndexFor(element) {
        if (element && element instanceof HTMLElement === false)
          return console.error(`${element} is not an instanceof HTMLElement`);

        return this._assignedNodes.indexOf(element || this.selected);
      }

      _updateSelected(selected) {
        selected.classList.add('custom-selected');
        if (this.currentSelected && this.currentSelected !== selected) {
          this.currentSelected.classList.remove('custom-selected');
        }
        this.currentSelected = selected;
      }

      /**
       * @param {string|number|HTMLElement} change.value
       */
      __selectedObserver__(value) {
        const type = typeof this.selected;
        if (Array.isArray(this.selected)) {
          for (const child of this._assignedNodes) {
            if (child.nodeType === 1) {
              if (this.selected.indexOf(child.getAttribute(this.attrForSelected)) !== -1) {
                child.classList.add('custom-selected');
              } else {
                child.classList.remove('custom-selected');
              }
            }
          }
          return;
        } else if (type === 'object') return this._updateSelected(this.selected);
        else if (type === 'string') {
          for (const child of this._assignedNodes) {
            if (child.nodeType === 1) {
              if (child.getAttribute(this.attrForSelected) === this.selected) {
                return this._updateSelected(child);
              }
            }
          }
        } else {
          // set selected by index
          const child = this._assignedNodes[this.selected];
          if (child && child.nodeType === 1) this._updateSelected(child);
          // remove selected even when nothing found, better to return nothing
        }
      }
    }
  };

  var SelectorMixin = base => {
    return class SelectorMixin extends SelectMixin(base) {

    static get properties() {
        return merge(super.properties, {
          selected: {
            value: 0,
            observer: '__selectedObserver__'
          },
          multi: {
            value: false,
            reflect: true
          }
        });
      }
      constructor() {
        super();
      }
      connectedCallback() {
        super.connectedCallback();
        this._onClick = this._onClick.bind(this);
        this.addEventListener('click', this._onClick);
      }
      disconnectedCallback() {
        this.removeEventListener('click', this._onClick);
      }
      _onClick(event) {
        const target = event.path ? event.path[0] : event.composedPath()[0];
        const attr = target.getAttribute(this.attrForSelected);
        let selected;

        if (target.localName !== this.localName) {
          selected = attr ? attr : target;
        } else {
          selected = attr;
        }
        if (this.multi) {
          if (!Array.isArray(this.selected)) this.selected = [];
          const index = this.selected.indexOf(selected);
          if (index === -1) this.selected.push(selected);
          else this.selected.splice(index, 1);
          // trigger observer
          this.select(this.selected);

        } else this.selected = selected;

        this.dispatchEvent(new CustomEvent('selected', { detail: selected }));
      }
    }
  };

  customElements.define('custom-tabs', class CustomTabs extends SelectorMixin(HTMLElement) {
    constructor() {
      super();
      this.attachShadow({mode: 'open'});
      this.shadowRoot.innerHTML = this.template;
    }
    // TODO: make scrollable
    get template() {
      return `
      <style>
        :host {
          display: flex;
          flex-direction: row;
          /*align-items: flex-end;*/
          height: var(--custom-tabs-height, 48px);
        }
      </style>
      <slot></slot>
    `;
    }
  });

}());

(function () {

  customElements.define('custom-tab', class CustomTab extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({mode: 'open'});
      this.shadowRoot.innerHTML = this.template;
      this._onMouseIn = this._onMouseIn.bind(this);
      this._onMouseOut = this._onMouseOut.bind(this);
    }

    connectedCallback() {
      this.addEventListener('mouseover', this._onMouseIn);
      this.addEventListener('mouseout', this._onMouseOut);
    }

    disconnected() {
      this.removeEventListener('mouseover', this._onMouseIn);
      this.removeEventListener('mouseout', this._onMouseOut);
    }

    _onMouseIn() {
      this.classList.add('over');
    }

    _onMouseOut() {
      this.classList.remove('over');
    }

    get template() {
      return `
    <style>
      :host {
        position: relative;
        display: inline-flex;
        width: 148px;
        height: 48px;
        align-items: center;
        justify-content: center;
        padding: 8px 12px;
        box-sizing: border-box;
        cursor: pointer;
        
        --tab-underline-color:  #00B8D4;
      }

      :host(.custom-selected) {
        border-bottom: 2px solid var(--tab-underline-color);
      }
      
      ::slotted(*) {
        pointer-events: none;
      }
    </style>
    <slot></slot>
    `;
    }
  });

}());

customElements.define('arteon-dialog', class ArteonDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          background: rgba(0,0,0, 0.38);
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0;
          pointer-events: none;
          z-index: 0;
        }

        .dialog {
          display: flex;
          flex-direction: column;
          width: 320px;
          max-height: 480px;
          height: 100%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 12px 24px;
          color: var(--main-color);
          background: var(--main-background-color);
          box-shadow: 0 1px 18px 0px var(--accent-color);
          border-radius: 24px;
        }

        :host([shown]) {
          opacity: 1 !important;
          pointer-events: auto !important;
          z-index: 10000;
        }
      </style>
      <span class="dialog">
        <flex-row>
          <flex-one></flex-one>
          <custom-svg-icon icon="close" data-close></custom-svg-icon>
        </flex-row>
        <slot></slot>
        <flex-one></flex-one>
        <flex-row>
          <custom-svg-icon icon="close" data-close></custom-svg-icon>
          <flex-one></flex-one>
          <custom-svg-icon icon="done" data-confirm></custom-svg-icon>
        </flex-row>
      </span>
    `;
    this.setAttribute('data-close', '');
  }

  async show() {
    this.setAttribute('shown', '');

    return new Promise((resolve, reject) => {
      const _onclick = event => {
        console.log(event);
        const target = event.composedPath()[0];
        if (target.hasAttribute('data-close')) {
          resolve({ action: 'close' });
          this.removeAttribute('shown');
          this.removeEventListener('click', _onclick);
          return
        }

        if (target.hasAttribute('data-confirm')) {
          const inputs = this.querySelectorAll('[data-input]');
          const value = {};
          for (const input of inputs) {
            value[input.getAttribute('data-input')] = input.value;
          }
          resolve({
            action: 'confirm',
            value
          });
          this.removeAttribute('shown');
          this.removeEventListener('click', _onclick);
        }
      };
      this.addEventListener('click', _onclick);
    })
  }
});

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

  _onSelected(selected) {
    console.log(selected);
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

    console.log(value);
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
        left: 0;
        top: 0;
        min-height: 110px;
        max-height: 240px;
        background: #333;
        border: 1px solid rgba(0,0,0,0.5);
        user-select: none;
        pointer-events: none;
        overflow: auto;
        z-index: 1001;
        display: flex;
        flex-direction: column;
        padding: 12px;
        box-sizing: border-box;
        height: 100%;
        outline: none;
        align-items: center;
        background: var(--main-background-color);
        border-color: var(--hero-border-color);
        border-radius: var(--hero-border-radius);
        color: var(--hero-color);
        pointer-events: none !important;
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

customElements.define('exchange-item', class ExchangeItem extends HTMLElement {

  static get observedAttributes() {
    return ['listing']
  }

  constructor() {
    super();
    this.attachShadow({mode: 'open'});

    this._ownerActions = '';
    this.asset = 'assets/arteon.svg';
    this.price = '0';
    this.symbol = 'ART';
    this.tokenId = '1';

    this.shadowRoot.innerHTML = this.template;
  }

  connectedCallback() {

  }

  attributeChangedCallback(name, old, value) {
    if(value !== old || !this[name]) this[name] = value;
  }

  set listing(listing) {
    this._observer();
  }

  get listing() {
    return this.getAttribute('listing')
  }

  set isOwner(isOwner) {
    this._observer();
  }

  get isOwner() {
    return this.getAttribute('is-owner')
  }

  _observer() {
    if (!this.listing || this.isOwner === undefined) return

    this._render(this.listing, Boolean(this.isOwner === 'true'));
  }

  async _render(listing, isOwner) {

    globalThis._contracts[api.addresses.exchange] = globalThis._contracts[api.addresses.exchange] || new ethers.Contract(api.addresses.exchange, EXCHANGE_ABI, api.signer);
    const exchangeContract = globalThis._contracts[api.addresses.exchange];
    listing = await exchangeContract.callStatic.lists(listing);

    globalThis._contracts[listing.gpu] = globalThis._contracts[listing.gpu] || new ethers.Contract(listing.gpu, GPU_ABI, api.signer);
    this.symbol = await globalThis._contracts[listing.gpu].callStatic.symbol();
    this.tokenId = listing.tokenId.toString();
    this.price = ethers.utils.formatUnits(listing.price, 18);
    this.asset = api.assets[this.symbol];

    this._ownerActions = isOwner ? `
      <flex-row class="owner-actions">
        <custom-svg-icon icon="add-shopping-cart"></custom-svg-icon>
        <custom-svg-icon icon="remove-shopping-cart"></custom-svg-icon>
        <custom-svg-icon icon="attach-money"></custom-svg-icon>
        <flex-one></flex-one>
        <custom-svg-icon icon="delete"></custom-svg-icon>
      </flex-row>
      ` : '';

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
        flex-direction: column;
        box-sizing: border-box;
        padding: 12px 24px 12px 24px;
        max-width: 320px;
        max-height: 274px;
        height: 100%;
        background: rgba(225,225,225,0.12);
        border-radius: 24px;
        ${elevation4dp}
      }
      button {
        display: flex;
        align-items: center;
        background: transparent;
        box-sizing: border-box;
        padding: 6px 24px;
        color: var(--main-color);
        border-color: var(--accent-color);
        border-radius: 12px;
        height: 40px;
        min-width: 86px;
        pointer-events: auto;
        cursor: pointer;
      }

      img {
        max-height: 154px;
        max-width: 274px;
        width: 100%;
        height: 100%;
      }

      flex-row {
        align-items: center;
      }
    </style>
    ${this._ownerActions}
    <flex-row>
      <span>${this.symbol}</span>
      <flex-one></flex-one>
      <strong>${this.tokenId}</strong>
    </flex-row>
    <img src="${this.asset}" loading="lazy"></img>
    <flex-one></flex-one>
    <flex-row>
      <span>${this.price}</span>
      <strong>ART</strong>
      <flex-one></flex-one>
      <button data-action="buy" data-listing="${this.listing}" data-id="${this.tokenId}">BUY</button>
    </flex-row>
      `
  }
});

var exchange = customElements.define('exchange-view', class ExchangeView extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;

    this._select = this._select.bind(this);
    this._onclick = this._onclick.bind(this);
    this._onsearch = this._onsearch.bind(this);
  }

  get _selector() {
    return this.shadowRoot.querySelector('custom-selector')
  }

  get _arrayRepeat() {
    return this.shadowRoot.querySelector('array-repeat')
  }

  connectedCallback() {
    this._init();
    this.shadowRoot.querySelector('[data-event="search"]').addEventListener('input', this._onsearch);
  }

  async _onsearch() {
    console.log(this.shadowRoot.querySelector('[data-event="search"]').value.length);
    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = () => setTimeout(async () => {

      const value = this.shadowRoot.querySelector('[data-event="search"]').value;
      if (value.length === 0) {
        this._arrayRepeat.items = this.listings;
        return
      }
      let items = this._arrayRepeat.shadowRoot.querySelectorAll('exchange-item');
      console.log({items});
      if (!items) return
      const isOwner = await this._isOwner();
      items = [...items].filter(item => item.symbol.toLowerCase().includes(value) || item.listing.includes(value) || item.dataset.index === value);
      items = items.map(item => {
        return { listing: item.listing, index: item.dataset.index, isOwner }
      });
      this._arrayRepeat.items = items;
    }, 500);
    this._timeout();
  }

  async _onclick(event) {
    console.log(event);
    console.log(event.target);
    console.log(event.composedPath());
    const target = event.composedPath()[0];
    if (target.hasAttribute('data-action')) {
      const action = target.getAttribute('data-action');
      switch (action) {
        case 'add':
          this._showDialog(action);
          break;
        case 'buy':
          const _target = this.shadowRoot.querySelector(`[data-target="${action}"]`);
          const listing = await this.contract.lists(target.dataset.listing);
          _target.querySelector('[data-input="address"]').value = listing.gpu;
          _target.querySelector('[data-input="tokenId"]').value = listing.tokenId;
          _target.querySelector('[data-input="price"]').innerHTML = ethers.utils.formatUnits(listing.price, 18);
          this._showDialog(action);
          break;
      }
      return
    }
  }

  async _showDialog(target) {
    const {action, value} = await this.shadowRoot.querySelector(`[data-target="${target}"]`).show();

    if (action === 'confirm') {
      switch (target) {
        case 'add':
          this._addListing(value);
          break;
        case 'buy':
          this._buyCard(value);
          break;
      }

    }
  }

  async _init() {
    this.addEventListener('click', this._onclick);
    const address = api.addresses.exchange;
    globalThis._contracts[address] = globalThis._contracts[address] || new ethers.Contract(address, EXCHANGE_ABI, api.signer);
    this.contract = globalThis._contracts[address];
    const _listings = await this.contract.callStatic.listingLength();
    console.log(_listings);
    const listings = [];

    for (var i = 0; i < _listings; i++) {
      listings.push(await this.contract.callStatic.listings(i));
      // array[i]
    }
    const isOwner = await this._isOwner();
    this.listings = listings.map((listing, index) => {
      return { listing, index, isOwner }
    });
    this._arrayRepeat.items = this.listings;
    this._selector.addEventListener('selected', this._select);

    if (isOwner) this._ownerSetup();
  }

  async _addListing({address, tokenId, price, tokenIdTo}) {
    tokenIdTo = tokenIdTo || tokenId;
    console.log({address, tokenId, price});
    globalThis._contracts[address] = globalThis._contracts[address] || new ethers.Contract(address, GPU_ABI, api.signer);

    const isApprovedForAll = await globalThis._contracts[address].callStatic.isApprovedForAll(api.signer.address, api.addresses.exchange);
    console.log(isApprovedForAll);
    if (!isApprovedForAll) {
      const approved = await globalThis._contracts[address].setApprovalForAll(api.addresses.exchange, true);
      await approved.wait();
    }
    let nonce = await api.signer.getTransactionCount();
    let promises = [];
    for (let i = Number(tokenId); i <= Number(tokenIdTo); i++) {
      promises.push(this.contract.list(address, i, ethers.utils.parseUnits(price, 18), {nonce: nonce++}));
    }
    promises = await Promise.all(promises);
    promises = promises.map(promise => promise.wait());
    promises = await Promise.all(promises);
  }

  async _buyCard({address, tokenId, price}) {
    const listing = await this.contract.callStatic.getListing(address, tokenId);
    await api.exchange.buy(listing, tokenId);
  }

  async _removeCard({address, tokenId, price}) {
    const contract = api.getContract(address);
    const gpuAddress = await contract.callStatic.arteonGPU();
    await api.exchange.remove(gpuAddress, tokenId);
  }

  async _isOwner() {
    return await this.contract.owner() === api.signer.address
  }

  _select({detail}) {
    this._pool.address = detail;
  }

  _ownerSetup() {
    this.setAttribute('is-owner', '');
    const items = this._arrayRepeat.shadowRoot.querySelectorAll('exchange-item');
    for (const item of items) {
      item.setAttribute('is-owner', '');
    }
    const repeat = this.shadowRoot.querySelector('custom-select').querySelector('array-repeat');
    repeat.items = Object.keys(api.addresses.pools).map(key => {
      return {
        name: key,
        address: api.addresses.cards[key]
      }
    });

    const _onGPUSelected = ({detail}) => {
      console.log(detail);
      this.shadowRoot.querySelector('[data-input="address"]').value = api.addresses.cards[detail];
    };
    _onGPUSelected({detail: 'genesis'});
    this.shadowRoot.querySelector('custom-select').selected = 'genesis';
    this.shadowRoot.querySelector('custom-select').addEventListener('selected', _onGPUSelected);
  }

  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        display: flex;
        flex-direction: column;
        --svg-icon-color: #eee;
        padding: 24px 96px 48px 96px;
        box-sizing: border-box;
        align-items: center;
      }

      custom-selector {
        height: 100%;
        flex-direction: row;
        border-radius: 44px;
        width: 100%;
        max-width: 720px;
        background: var(--custom-drawer-background);
        overflow-y: auto;
        pointer-events: auto;
        display: flex;
        box-sizing: border-box;
        padding: 24px;
        ${elevation2dp}
      }

      :host, .container {
        width: 100%;
        height: 100%;
      }

      custom-tab {
        --tab-underline-color: var(--accent-color);
      }

      @media (max-width: 440px) {
        header {
          opacity: 0;
          pointer-events: none;
        }
      }


      button {
        display: flex;
        align-items: center;
        background: transparent;
        box-sizing: border-box;
        padding: 6px 24px;
        color: var(--main-color);
        border-color: var(--accent-color);
        border-radius: 12px;
      }

      custom-input {
        --custom-input-color: var(--main-color);
        box-shadow: 0px 1px 3px -1px var(--accent-color);
        margin-bottom: 24px;
      }

      flex-row.owner-buttons {
        position: absolute;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
      }

      button {
        pointer-events: auto;
      }

      .owner-controls {
        opacity: 0;
        pointer-events: none;
      }

      :host([is-owner]) .owner-controls.showable {
        opacity: 1;
        pointer-events: auto;
      }

      custom-pages [data-route] {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      custom-input {
        pointer-events: auto;
      }

      .item {
        display: flex;
      }

      array-repeat {
        display: flex;
        flex-direction: column;
        width: 100%;
        pointer-events: auto
      }

      custom-input {
        pointer-events: auto;
        padding: 12px;
        box-sizing: border-box;
        max-width: 640px;
        background: var(--custom-drawer-background);
        --custom-input-color: var(--main-color);
        border-radius: 24px;

        ${elevation2dp}
      }

      custom-pages {
        width: 100%;
      }
      custom-selector array-repeat {
        flex-flow: row wrap;
        justify-content: space-between;
      }
      @media(max-width: 890px) {
        custom-selector {
          max-width: 374px;
        }
        :host {
          padding: 24px;
        }
      }

      @media(min-width: 1150px) {
        custom-selector {
          max-width: 720px;
        }
      }
      @media(min-width: 1480px) {
        custom-selector {
          max-width: 1400px;
        }
      }

    </style>
    <!--<custom-input data-event="search" placeholder="search by name/address"></custom-input>-->
    <custom-pages>
      <section data-route="overview">
        <custom-selector>
          <array-repeat max="12">
            <style>
              exchange-item {
                margin-bottom: 12px;
              }
            </style>
            <template>
              <exchange-item listing="[[item.listing]]" is-owner="[[item.isOwner]]"></exchange-item>
            </template>
          </array-repeat>
        </custom-selector>
      </section>
    </custom-pages>
    <flex-row class="owner-buttons owner-controls showable">
      <button data-action="add">
        <custom-svg-icon icon="add"></custom-svg-icon>
        <flex-one></flex-one>
        <strong>ADD CARD</strong>
      </button>
    </flex-row>

    <arteon-dialog class="owner-controls" data-target="add">
      <h4>Add card</h4>
      <custom-select>
        <array-repeat>
          <template>
            <span class="item" title="[[item.listing]]" data-route="[[item.name]]" data-listing="[[item.listing]]">
              [[item.name]]
            </span>
          </template>
        </array-repeat>
      </custom-select>
      <custom-input data-input="address" placeholder="ArteonGPU"></custom-input>
      <custom-input data-input="tokenId" placeholder="TokenId"></custom-input>
      <custom-input data-input="tokenIdTo" placeholder="till TokenId"></custom-input>
      <custom-input data-input="price" placeholder="price"></custom-input>
    </arteon-dialog>

    <arteon-dialog class="owner-controls" data-target="buy">
      <h4>buy</h4>
      <custom-input data-input="address" placeholder="ArteonGPU"></custom-input>
      <custom-input data-input="tokenId" placeholder="TokenId"></custom-input>
      <flex-row>
        <strong>for</strong>
        <flex-one></flex-one>
        <span data-input="price"></span>
        <strong>ART</strong>
      </flex-row>

    </arteon-dialog>
    `
  }
});

export default exchange;
