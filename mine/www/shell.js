import { E as EXCHANGE_ABI } from './exchange-1fd4387f.js';
import { e as elevation2dp } from './elevation-f8af9a6d.js';

((function () {

var customSvgIconset = ((base = HTMLElement) => {
  window.svgIconset = window.svgIconset || {};
  customElements.define('custom-svg-iconset', class CustomSvgIconset extends base {
    static get observedAttributes() {
      return ['name', 'theme', 'size'];
    }
    constructor() {
      super();
    }
    connectedCallback() {
      if (!this.hasAttribute('name')) {
        this.name = this.name;
      }
      this.style.display = 'none';
    }
    get name() {
      return this._name || 'icons';
    }
    get theme() {
      return this._theme || 'light';
    }
    get size() {
      return this._size || 24;
    }
    set name(value) {
      if (this._name !== value) {
        this._name = value;
        window.svgIconset[value] = { host: this, theme: this.theme };
        window.dispatchEvent(new CustomEvent('svg-iconset-update'));
        window.dispatchEvent(new CustomEvent('svg-iconset-added', { detail: value }));
      }
    }
    set theme(value) {
      if (this._theme !== value && this.name) {
        window.svgIconset[this.name] = { host: this, theme: value };
        window.dispatchEvent(new CustomEvent('svg-iconset-update'));
      }
      this._theme = value;
    }
    set size(value) {
      this._size = value;
    }
    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal !== newVal) {
        this[name] = newVal;
      }
    }
    applyIcon(element, icon) {
      element = element.shadowRoot || element;
      this.removeIcon(element);
      this._cloneIcon(icon).then(icon => {
        element.insertBefore(icon, element.childNodes[0]);
        element._iconSetIcon = icon;
      });
    }
    removeIcon(element) {
      element = element.shadowRoot || element;
      if (element._iconSetIcon) {
        element.removeChild(element._iconSetIcon);
        element._iconSetIcon = null;
      }
    }
    _cloneIcon(id) {
      return new Promise((resolve, reject) => {
        try {
          this._icons = this._icons || this._createIconMap();
          let svgClone = this._prepareSvgClone(this._icons[id], this.size);
          resolve(svgClone);
        } catch (error) {
          reject(error);
        }
      });
    }
    _createIconMap() {
      var icons = Object.create(null);
      this.querySelectorAll('[id]').forEach(icon => {
        icons[icon.id] = icon;
      });
      return icons;
    }
    _prepareSvgClone(sourceSvg, size) {
      if (sourceSvg) {
        var content = sourceSvg.cloneNode(true),
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
            viewBox = content.getAttribute('viewBox') || '0 0 ' + size + ' ' + size,
            cssText = 'pointer-events: none; display: block; width: 100%; height: 100%;';
        svg.setAttribute('viewBox', viewBox);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.cssText = cssText;
        svg.appendChild(content).removeAttribute('id');
        return svg;
      }
      return null;
    }
  });
})();

return customSvgIconset;

})());

((function () {

var customSvgIcon = ((base = HTMLElement) => {
  customElements.define('custom-svg-icon', class CustomSvgIcon extends base {
    static get observedAttributes() {
      return ['icon'];
    }
    get iconset() {
      return window.svgIconset;
    }
    set iconset(value) {
      window.iconset = value;
    }
    set icon(value) {
      if (this.icon !== value) {
        this._icon = value;
        this.__iconChanged__({ value: value });
      }
    }
    get icon() {
      return this._icon;
    }
    get template() {
      return `
        <style>
          :host {
            width: var(--svg-icon-size, 24px);
            height: var(--svg-icon-size, 24px);
            display: inline-flex;
            display: -ms-inline-flexbox;
            display: -webkit-inline-flex;
            display: inline-flex;
            -ms-flex-align: center;
            -webkit-align-items: center;
            align-items: center;
            -ms-flex-pack: center;
            -webkit-justify-content: center;
            justify-content: center;
            position: relative;
            vertical-align: middle;
            fill: var(--svg-icon-color, #111);
            stroke: var(--svg-icon-stroke, none);
          }
        </style>
      `;
    }
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._onIconsetReady = this._onIconsetReady.bind(this);
    }
    render() {
      this.shadowRoot.innerHTML = this.template;
    }
    connectedCallback() {
      this.icon = this.getAttribute('icon') || null;
      if (!super.render) this.render();
    }
    _onIconsetReady() {
      window.removeEventListener('svg-iconset-added', this._onIconsetReady);
      this.__iconChanged__({ value: this.icon });
    }
    __iconChanged__(change) {
      if (!this.iconset) {
        window.addEventListener('svg-iconset-added', this._onIconsetReady);
        return;
      }
      if (change.value && this.iconset) {
        let parts = change.value.split('::');
        if (parts.length === 1) {
          this.iconset['icons'].host.applyIcon(this, change.value);
        } else if (this.iconset[parts[0]]) {
          this.iconset[parts[0]].host.applyIcon(this, parts[1]);
        }
      } else if (!change.value && this.iconset && this._icon) {
        let parts = this._icon.split('::');
        if (parts.length === 1) {
          this.iconset['icons'].host.removeIcon(this);
        } else {
          this.iconset[parts[0]].host.removeIcon(this);
        }
      }
      this.iconset = this.iconset;
    }
    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue !== newValue) this[name] = newValue;
    }
  });
})();

return customSvgIcon;

})());

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

/**
 * @extends HTMLElement
 */
class CustomPages extends SelectMixin(HTMLElement) {
  constructor() {
    super();
    this.slotchange = this.slotchange.bind(this);
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          flex: 1;
          position: relative;
          --primary-background-color: #ECEFF1;
          overflow: hidden;
        }
        ::slotted(*) {
          display: flex;
          position: absolute;
          opacity: 0;
          pointer-events: none;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          transition: transform ease-out 160ms, opacity ease-out 60ms;
          /*transform: scale(0.5);*/
          transform-origin: left;
        }
        ::slotted(.animate-up) {
          transform: translateY(-120%);
        }
        ::slotted(.animate-down) {
          transform: translateY(120%);
        }
        ::slotted(.custom-selected) {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
          transition: transform ease-in 160ms, opacity ease-in 320ms;
          max-height: 100%;
          max-width: 100%;
        }
      </style>
      <!-- TODO: scale animation, ace doesn't resize that well ... -->
      <div class="wrapper">
        <slot></slot>
      </div>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.querySelector('slot').addEventListener('slotchange', this.slotchange);
  }

  isEvenNumber(number) {
    return Boolean(number % 2 === 0)
  }

  /**
   * set animation class when slot changes
   */
  slotchange() {
    let call = 0;
    for (const child of this.slotted.assignedNodes()) {
      if (child && child.nodeType === 1) {
        child.style.zIndex = 99 - call;
        if (this.isEvenNumber(call++)) {
          child.classList.add('animate-down');
        } else {
          child.classList.add('animate-up');
        }
        this.dispatchEvent(new CustomEvent('child-change', {detail: child}));
      }
    }
  }
}customElements.define('custom-pages', CustomPages);

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

const define  = klass => customElements.define('custom-selector', klass);
define(class CustomSelector extends SelectorMixin(HTMLElement) {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = '<slot></slot>';
  }
});

var arteonAddresses = async (network = 'ropsten') => {
  const importee = await import(`./addresses/${network}.js`);
  return importee.default
};

var LISTING_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "arteonGPU",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "factory",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokenId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      }
    ],
    "name": "buy",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner_",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "token_",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "arteonGPU_",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId_",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "price_",
        "type": "uint256"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "setPrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "isListed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bool",
        "name": "delisted",
        "type": "bool"
      }
    ],
    "name": "delist",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

var ARTEON_ABI = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "name_",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "symbol_",
				"type": "string"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "Approval",
		"type": "event",
		"signature": "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event",
		"signature": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
	},
	{
		"inputs": [],
		"name": "governance",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x5aa6e675"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "minters",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0xf46eccc4"
	},
	{
		"inputs": [],
		"name": "percentSettings",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x3bee96bb"
	},
	{
		"inputs": [],
		"name": "name",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x06fdde03"
	},
	{
		"inputs": [],
		"name": "symbol",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x95d89b41"
	},
	{
		"inputs": [],
		"name": "decimals",
		"outputs": [
			{
				"internalType": "uint8",
				"name": "",
				"type": "uint8"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x313ce567"
	},
	{
		"inputs": [],
		"name": "totalSupply",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x18160ddd"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x70a08231"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "transfer",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0xa9059cbb"
	},
	{
		"inputs": [
			{
				"internalType": "address[]",
				"name": "receivers",
				"type": "address[]"
			},
			{
				"internalType": "uint256[]",
				"name": "amounts",
				"type": "uint256[]"
			}
		],
		"name": "multiTransfer",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x1e89d545"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			}
		],
		"name": "allowance",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0xdd62ed3e"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "burnPercentage",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x05114d70"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "approve",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x095ea7b3"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "transferFrom",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x23b872dd"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "addedValue",
				"type": "uint256"
			}
		],
		"name": "increaseAllowance",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x39509351"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "subtractedValue",
				"type": "uint256"
			}
		],
		"name": "decreaseAllowance",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0xa457c2d7"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "mint",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x40c10f19"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "burn",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x42966c68"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "burnFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x79cc6790"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_governance",
				"type": "address"
			}
		],
		"name": "setGovernance",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0xab033ea9"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_minter",
				"type": "address"
			}
		],
		"name": "addMinter",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x983b2d56"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_minter",
				"type": "address"
			}
		],
		"name": "removeMinter",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x3092afd5"
	}
];

var bytecode = '0x608060405234801561001057600080fd5b50600080546001600160a01b03191633179055610da8806100326000396000f3fe608060405234801561001057600080fd5b50600436106100be5760003560e01c8063a6b63eb811610076578063c45a01551161005b578063c45a015514610141578063d910b05a14610149578063f088d5471461015e576100be565b8063a6b63eb81461011b578063b5f855211461012e576100be565b80638da5cb5b116100a75780638da5cb5b146100f657806391b7f5ed146100fe57806398d5fdca14610113576100be565b806317d70f7c146100c357806347712164146100e1575b600080fd5b6100cb610171565b6040516100d89190610d0a565b60405180910390f35b6100e9610177565b6040516100d89190610a7a565b6100e9610193565b61011161010c366004610a2e565b6101af565b005b6100cb61020e565b61011161012936600461099c565b610214565b61011161013c3660046109f6565b6102d0565b6100e9610352565b61015161036e565b6040516100d89190610acc565b61011161016c366004610964565b61038a565b60045481565b60035473ffffffffffffffffffffffffffffffffffffffff1681565b60015473ffffffffffffffffffffffffffffffffffffffff1690565b60005473ffffffffffffffffffffffffffffffffffffffff163314610209576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020090610b85565b60405180910390fd5b600555565b60055490565b60005473ffffffffffffffffffffffffffffffffffffffff163314610265576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020090610b85565b600380547fffffffffffffffffffffffff000000000000000000000000000000000000000090811673ffffffffffffffffffffffffffffffffffffffff9586161790915560049290925560055560018054821694831694909417909355600280549093169116179055565b60005473ffffffffffffffffffffffffffffffffffffffff163314610321576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020090610b85565b600680547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0016911515919091179055565b60005473ffffffffffffffffffffffffffffffffffffffff1681565b60065460009060ff16610382576001610385565b60005b905090565b60005473ffffffffffffffffffffffffffffffffffffffff1633146103db576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020090610b85565b6103e4816104a9565b6002546001546005546104149273ffffffffffffffffffffffffffffffffffffffff90811692859291169061068d565b600354600154600480546040517f42842e0e00000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff948516946342842e0e94610474949116928792909101610a9b565b600060405180830381600087803b15801561048e57600080fd5b505af11580156104a2573d6000803e3d6000fd5b5050505050565b600154600354600480546040517f6352211e00000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff9485169490931692636352211e92610507929101610d0a565b60206040518083038186803b15801561051f57600080fd5b505afa158015610533573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906105579190610980565b73ffffffffffffffffffffffffffffffffffffffff16146105a4576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020090610bbc565b6002546040517f70a0823100000000000000000000000000000000000000000000000000000000815260009173ffffffffffffffffffffffffffffffffffffffff16906370a08231906105fb908590600401610a7a565b60206040518083038186803b15801561061357600080fd5b505afa158015610627573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061064b9190610a46565b9050600554811015610689576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020090610c19565b5050565b610730846323b872dd60e01b8585856040516024016106ae93929190610a9b565b604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe08184030181529190526020810180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167fffffffff0000000000000000000000000000000000000000000000000000000090931692909217909152610736565b50505050565b6000610798826040518060400160405280602081526020017f5361666545524332303a206c6f772d6c6576656c2063616c6c206661696c65648152508573ffffffffffffffffffffffffffffffffffffffff166107f19092919063ffffffff16565b8051909150156107ec57808060200190518101906107b69190610a12565b6107ec576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020090610cad565b505050565b6060610800848460008561080a565b90505b9392505050565b606082471015610846576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020090610b28565b61084f8561090b565b610885576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020090610c76565b6000808673ffffffffffffffffffffffffffffffffffffffff1685876040516108ae9190610a5e565b60006040518083038185875af1925050503d80600081146108eb576040519150601f19603f3d011682016040523d82523d6000602084013e6108f0565b606091505b5091509150610900828286610911565b979650505050505050565b3b151590565b60608315610920575081610803565b8251156109305782518084602001fd5b816040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016102009190610ad7565b600060208284031215610975578081fd5b813561080381610d3f565b600060208284031215610991578081fd5b815161080381610d3f565b600080600080600060a086880312156109b3578081fd5b85356109be81610d3f565b945060208601356109ce81610d3f565b935060408601356109de81610d3f565b94979396509394606081013594506080013592915050565b600060208284031215610a07578081fd5b813561080381610d64565b600060208284031215610a23578081fd5b815161080381610d64565b600060208284031215610a3f578081fd5b5035919050565b600060208284031215610a57578081fd5b5051919050565b60008251610a70818460208701610d13565b9190910192915050565b73ffffffffffffffffffffffffffffffffffffffff91909116815260200190565b73ffffffffffffffffffffffffffffffffffffffff9384168152919092166020820152604081019190915260600190565b901515815260200190565b6000602082528251806020840152610af6816040850160208701610d13565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169190910160400192915050565b60208082526026908201527f416464726573733a20696e73756666696369656e742062616c616e636520666f60408201527f722063616c6c0000000000000000000000000000000000000000000000000000606082015260800190565b6020808252601a908201527f417274656f6e4c697374696e673a204e4f545f414c4c4f574544000000000000604082015260600190565b60208082526022908201527f417274656f6e4c697374696e673a2053454c4c45525f444f45535f4e4f545f4f60408201527f574e000000000000000000000000000000000000000000000000000000000000606082015260800190565b60208082526021908201527f417274656f6e45786368616e67653a204e4f545f454e4f5547485f544f4b454e60408201527f5300000000000000000000000000000000000000000000000000000000000000606082015260800190565b6020808252601d908201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e7472616374000000604082015260600190565b6020808252602a908201527f5361666545524332303a204552433230206f7065726174696f6e20646964206e60408201527f6f74207375636365656400000000000000000000000000000000000000000000606082015260800190565b90815260200190565b60005b83811015610d2e578181015183820152602001610d16565b838111156107305750506000910152565b73ffffffffffffffffffffffffffffffffffffffff81168114610d6157600080fd5b50565b8015158114610d6157600080fdfea2646970667358221220dcf5ec917df725c23bc01ac619c92a158305b34b37424992c4c50f58d5014eeb64736f6c63430008000033';

class Api {
  constructor(signer) {
    return this._init(signer)
  }

  async _init(signer) {
    this.signer = signer;
    if (!this.signer.address) {
      this.signer.address = await this.signer.getAddress();
    }

    return this
  }

  get assets() {
    return {
      GENESIS: './assets/cards/GENESIS-720.png',
      'ARTX 1000': './assets/cards/ARTX 1000-720.png',
      'ARTX 2000': './assets/cards/ARTX 2000-720.png'
    }
  }

  get maximumSupply() {
    return {
      GENESIS: 50,
      'ARTX 1000': 450,
      'ARTX 2000': 250
    }
  }

  getAssetFor(symbol) {
    return this.assets[symbol]
  }

  getContract(address, abi) {
    globalThis._contracts[address] = globalThis._contracts[address] || new ethers.Contract(address, abi, api.signer);
    return globalThis._contracts[address]
  }

  get listing() {
    return {
      price: listing => {
        const contract = this.getContract(listing, LISTING_ABI);
        return contract.getPrice()
      },
      createAddress: (gpu, tokenId) => {
        const { getCreate2Address, solidityPack, solidityKeccak256} = globalThis.ethers.utils;
        return getCreate2Address(
          this.addresses.exchange,
          solidityKeccak256(['bytes'], [solidityPack(['address', 'uint256'], [gpu, tokenId])]),
          solidityKeccak256(['bytes'], [bytecode])
        )
      }
    }
  }

  get arteon() {
    this.getContract(api.addresses.exchange, EXCHANGE_ABI);
    return {

    }
  }

  get exchange() {
    return {
      buy: async (listing, tokenId) => {
        console.log({listing, tokenId});
        const exchangeContract = this.getContract(api.addresses.exchange, EXCHANGE_ABI);
        listing = await exchangeContract.callStatic.lists(listing);
        console.log(listing);
        const contract = api.getContract(api.addresses.token, ARTEON_ABI);
        const approve = await contract.approve(this.addresses.exchange, listing.price);
        await approve.wait();
        return exchangeContract.buy(listing.gpu, listing.tokenId, {gasLimit: 400000})
      }
    }
  }

  get token() {
    return {
      approve: (address, amount) => {
        const contract = this.getContract(api.addresses.token, ARTEON_ABI);
        return contract.approve(address, amount)
      }
    }
  }
}

customElements.define('custom-drawer', class CustomDrawer extends HTMLElement {
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
        width: var(--custom-drawer-width, 256px);
        height: auto;
        background: var(--custom-drawer-background, #FFF);
        background-blend-mode: hue;
        color: var(--custom-drawer-color, #333);
        opacity: 0;
        box-shadow: 0 5px 5px 5px rgba(0, 0, 0, 0.14);
      }
      ::slotted([slot="header"]) {
        display: block;
        box-sizing: border-box;
        min-height: 48px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.14);
        color: var(--custom-header-color, #FFF);
        background: var(--custom-header-background, #EEE);
      }
      ::slotted([slot="footer"]) {
        display: block;
        box-sizing: border-box;
        min-height: 48px;
        border-top: 1px solid rgba(0, 0, 0, 0.14);
      }
      ::slotted([slot="content"]) {
        display: flex;
        flex-direction: column;
        width: 100%;
      }
    </style>
    <slot name="header"></slot>
    <slot name="content"></slot>
    <slot name="footer"></slot>`;
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

customElements.define('flex-two', class FlexTwo extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
  }
  get template() {
    return `<style>
      :host {
        flex: 2;
      }
    </style>
    
    <slot></slot>`
  }
});

customElements.define('flex-three', class FlexThree extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
  }
  get template() {
    return `<style>
      :host {
        flex: 3;
      }
    </style>
    
    <slot></slot>`
  }
});

customElements.define('flex-four', class FlexFour extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
  }
  get template() {
    return `<style>
      :host {
        flex: 4;
      }
    </style>
    
    <slot></slot>`
  }
});

customElements.define('flex-wrap-around', class FlexWrapAround extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
  }
  get template() {
    return `<style>
      :host {
        display: flex;
        flex-flow: row wrap;
        justify-content: space-around;
      }      
    </style>
    <slot></slot>
    `
  }
});

customElements.define('flex-wrap-evenly', class FlexWrapEvenly extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
  }
  get template() {
    return `<style>
      :host {
        display: flex;
        flex-flow: row wrap;
        justify-content: space-evenly;
      }      
    </style>
    <slot></slot>
    `
  }
});

customElements.define('flex-wrap-between', class FlexWrapBetween extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
  }
  get template() {
    return `<style>
      :host {
        display: flex;
        flex-flow: row wrap;
        justify-content: space-between;
      }      
    </style>
    <slot></slot>
    `
  }
});

globalThis._contracts = globalThis._contracts || [];

var shell = customElements.define('mine-shell', class extends HTMLElement {

  static get observedAttributes() {
    return ['desktop']
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this[name] = newValue;
  }
  set desktop(value) {
  }

  get _pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  get _selector() {
    return this.shadowRoot.querySelector('custom-selector')
  }

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;

    this._select = this._select.bind(this);
    this._loadAccounts = this._loadAccounts.bind(this);

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jdenticon@3.1.0/dist/jdenticon.min.js';
    script.setAttribute('async', '');
    script.setAttribute('integrity', 'sha384-VngWWnG9GS4jDgsGEUNaoRQtfBGiIKZTiXwm9KpgAeaRn6Y/1tAFiyXqSzqC8Ga/');
    script.setAttribute('crossorigin', 'anonymous');

    document.head.appendChild(script);
    this._onMenuButtonClick = this._onMenuButtonClick.bind(this);
    this._init();
  }

  connectedCallback() {
    this.shadowRoot.querySelector('custom-svg-icon[icon="menu"]').addEventListener('click', this._onMenuButtonClick);
  }

  _onMenuButtonClick() {
    this.hasAttribute('drawer-opened') ? this.removeAttribute('drawer-opened') : this.setAttribute('drawer-opened', '');
  }

  _networkNameFor(version) {
    const networksByVersion = {
      0: 'mainnet',
      3: 'ropsten',
      42: 'kovan',
      7475: 'wapnet'
    };

    return networksByVersion[version]
  }


  async _loadAccounts(accounts) {
    const provider = new ethers.providers.Web3Provider(ethereum);
    console.log(provider);
    const signer = await provider.getSigner();
    const networkVersion = Number(ethereum.networkVersion);
    console.log(networkVersion);
    if (accounts[0] === this.address && api.chainId === Number(ethereum.networkVersion)) return
    globalThis.api = await new Api(signer);
    this.address = api.signer.address;
    api.chainId = Number(ethereum.networkVersion);
    api.addresses = await arteonAddresses(this._networkNameFor(api.chainId));
    // jdenticon.update(this.shadowRoot.querySelector('.avatar'), accounts[0])
  }

  async setTheme(theme) {
    const importee = await import(`./themes/${theme}.js`);
    for (const prop of Object.keys(importee.default)) {
      document.querySelector('body').style.setProperty(`--${prop}`, importee.default[prop]);
    }

    return
  }

  async _init() {

    await this.setTheme('dark');

    const updatePlatform = ({matches}) => {
      if (matches) {
        this.removeAttribute('desktop');
        this.removeAttribute('drawer-opened');
        return
      }
      this.setAttribute('desktop', '');
      this.setAttribute('drawer-opened', '');
    };

    const desktop = globalThis.matchMedia('(max-width: 1200px)');
    updatePlatform(desktop);
    desktop.addListener(updatePlatform);


    // await import('./views/login.js')
    await import('./third-party/ethers.js');

    const accounts = await ethereum.request({method: 'eth_requestAccounts'});
    await this._loadAccounts(accounts);

    ethereum.on('accountsChanged', this._loadAccounts);
    ethereum.on('chainChanged', this._loadAccounts);

    this._selector.addEventListener('selected', this._select);

    this._select({detail: 'pools'});
    import('./exchange.js');
  }

  async _select({detail}) {
    const tag = `${detail}-view`;
    console.log(detail);

    if (!customElements.get(tag)) await import(`./${detail}.js`);
    if (!this.hasAttribute('desktop')) this.removeAttribute('drawer-opened');
    this._pages.select(detail);
  }

  get template() {
    return `
    <style>
    * {
      pointer-events: none;
      user-select: none;
      outline: none;
    }
    :host {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      background: var(--main-background-color);
    }
    .container {
      position: absolute;
      display: flex;
      flex-direction: column;
      left: 0;
      right: 0;
      bottom: 0;
      top: 72px;
    }

    .avatar {
      max-height: 48px;
      border-radius: 50%;
      position: absolute;
      right: 12px;
      top: 12px;
    }

    custom-selector {
      cursor: pointer;
    }

    header {
      display: flex;
      height: var(--main-header-height);
      background: var(--main-background-color);
      color: var(--main-color);
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      padding: 12px 24px;
      box-sizing: border-box;
      align-items: center;
    }

    .logo {
      width: 48px;
      height: 48px;
    }

    custom-selector {
      height: 100%;
      background: var(--custom-drawer-background);
      padding: 48px 0 24px 24px;
      box-sizing: border-box;
    }

    .drawer-item {
      pointer-events: auto;
      font-size: 20px;
      font-weight: 700;
      text-transform: uppercase;
      align-items: center;
      display: flex;
      --svg-icon-size: 24px;
      --svg-icon-color: var(--main-color);
      color: var(--main-color);
      padding: 12px;
      box-sizing: border-box;
    }

    .drawer-item custom-svg-icon {
      padding-right: 12px;
    }

    .drawer-item.custom-selected {
      background: var(--accent-color);
      border-top-left-radius: 24px;
      border-bottom-left-radius: 24px;
      color: #eee;
      --svg-icon-color: #eee;
    }

    custom-drawer {
      height: calc(100% - var(--main-header-height) - 48px);
      transform: translateX(-110%);
      border-top-right-radius: 44px;
      border-bottom-right-radius: 44px;
      top: 96px;
      position: absolute;
      overflow: hidden;
      z-index: 10000;
      ${elevation2dp}
    }

    :host([drawer-opened]) custom-drawer {
      opacity: 1;
      transform: translateX(0);
    }

    :host([drawer-opened][desktop]) .container {
      opacity: 1;
      left: var(--custom-drawer-width);
    }

    header h1 {
      padding-left: 24px;
      text-transform: capitalize;
      font-weight: 700;
      font-size: 44px;
      letter-spacing: 12px;
    }

    a img {
      width: 32px;
    }

    a {
      pointer-events: auto;
    }

    flex-row[slot="footer"] {
      display: flex !important;
      align-items: center;
      padding: 12px;
      box-sizing: border-box;
    }

    custom-svg-icon[icon="menu"] {
      --svg-icon-color: var(--main-color);
      --svg-icon-size: 48px;
      position: absolute;
      left: 24px;
      top: 24px;
      pointer-events: auto;
    }

    :host([drawer-opened][desktop]) custom-svg-icon[icon="menu"] {
      pointer-events: none;
      opacity: 0;
    }

    .title, .middle-title {
      align-items: center;
    }

    header .title {
      position: absolute;
      transform: translateX(-50%);
      left: 50%;
      top: 24px;
      height: 54px;
    }

    :host([desktop]) header .title {
      transform: translate(0);
      left: 24px;
      top: 24px;
    }

    </style>
    <custom-svg-iconset>
      <svg><defs>
        <g id="add"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></g>
        <g id="add-shopping-cart"><path d="M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-9.83-3.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4h-.01l-1.1 2-2.76 5H8.53l-.13-.27L6.16 6l-.95-2-.94-2H1v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.13 0-.25-.11-.25-.25z"></path></g>
        <g id="attach-money"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"></path></g>
        <g id="arrow-back"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></g>
        <g id="arrow-drop-down"><path d="M7 10l5 5 5-5z"></path></g>
        <g id="assessment"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"></path></g>
        <g id="close"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></g>
        <g id="compare-arrows"><path d="M9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z"></path></g>
        <g id="delete"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></g>
        <g id="build"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"></path></g>
        <g id="done"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"></path></g>
        <g id="remove-shopping-cart"><path d="M22.73 22.73L2.77 2.77 2 2l-.73-.73L0 2.54l4.39 4.39 2.21 4.66-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h7.46l1.38 1.38c-.5.36-.83.95-.83 1.62 0 1.1.89 2 1.99 2 .67 0 1.26-.33 1.62-.84L21.46 24l1.27-1.27zM7.42 15c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h2.36l2 2H7.42zm8.13-2c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H6.54l9.01 9zM7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2z"></path></g>
        <g id="swap-horiz"><path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"></path></g>
        <g id="local-offer"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"></path></g>
        <g id="menu"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"></path></g>
        <g id="memory"><path d="M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z"></path></g>
        <g id="playlist-add"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"></path></g>
      </defs></svg>
    </custom-svg-iconset>
    <custom-drawer>
      <custom-selector slot="content" attr-for-selected="data-route">
        <span class="drawer-item" data-route="pools">
          <custom-svg-icon icon="assessment"></custom-svg-icon>
          <span>pools</span>
        </span>

        <span class="drawer-item" data-route="exchange">
          <custom-svg-icon icon="swap-horiz"></custom-svg-icon>
          <span>exchange</span>
        </span>

        <span class="drawer-item" data-route="auction">
          <custom-svg-icon icon="attach-money"></custom-svg-icon>
          <span>auction</span>
        </span>

        <!-- <span class="drawer-item" data-route="buy-arteon">
          <custom-svg-icon icon="local-offer"></custom-svg-icon>
          <span>buy arteon</span>
        </span>
        -->
      </custom-selector>

      <flex-row slot="footer">
        <flex-two></flex-two>
        <a href="https://twitter.com/ArteonToken" title="Follow us on Twitter!">
          <img src="./assets/social/twitter-white.svg"></img>
        </a>
        <flex-one></flex-one>
        <a href="https://t.me/ARTEONDEFI" title="Join us on Telegram!">
          <img src="./assets/social/telegram-white.svg"></img>
        </a>
        <flex-one></flex-one>
        <a href="https://discord.com/invite/gxZAJNg8cM" title="Let's discuss on Discord!">
          <img src="./assets/social/discord-white.svg"></img>
        </a>
        <flex-two></flex-two>
      </flex-row>
    </custom-drawer>
    <!-- <canvas class="avatar"></canvas> -->

    <header>
      <flex-row class="title">
        <img class="logo" src="./assets/arteon-dark.png"></img>
        <h1>arteon</h1>
      </flex-row>
    </header>
    <span class="container">
      <custom-pages attr-for-selected="data-route">
        <exchange-view data-route="exchange"></exchange-view>
        <pools-view data-route="pools"></pools-view>
        <buy-arteon-view data-route="buy-arteon"></buy-arteon-view>
      </custom-pages>
    </span>

    <custom-svg-icon icon="menu"></custom-svg-icon>
    `
  }
});

export default shell;
