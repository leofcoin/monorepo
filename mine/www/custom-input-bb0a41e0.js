var GPU_ABI = [
	{
		"inputs": [],
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
				"name": "approved",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
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
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "approved",
				"type": "bool"
			}
		],
		"name": "ApprovalForAll",
		"type": "event",
		"signature": "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "previousOwner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event",
		"signature": "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0"
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
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event",
		"signature": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			}
		],
		"name": "addCard",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x3dc50952"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "approve",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x095ea7b3"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
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
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "getApproved",
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
		"signature": "0x081812fc"
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
				"name": "operator",
				"type": "address"
			}
		],
		"name": "isApprovedForAll",
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
		"signature": "0xe985e9c5"
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
		"name": "owner",
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
		"signature": "0x8da5cb5b"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ownerOf",
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
		"signature": "0x6352211e"
	},
	{
		"inputs": [],
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x715018a6"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x42842e0e"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			},
			{
				"internalType": "bytes",
				"name": "_data",
				"type": "bytes"
			}
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0xb88d4fde"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "approved",
				"type": "bool"
			}
		],
		"name": "setApprovalForAll",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0xa22cb465"
	},
	{
		"inputs": [],
		"name": "supplyCap",
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
		"signature": "0x8f770ad0"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
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
		"signature": "0x01ffc9a7"
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
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "tokenURI",
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
		"signature": "0xc87b56dd"
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
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "transferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x23b872dd"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0xf2fde38b"
	}
];

/**
 * @class ArrayRepeat
 */
class ArrayRepeat extends HTMLElement {
  /**
   * @return {array} ['items', 'name-space']
   */
  static get observedAttributes() {
    return ['items', 'name-space', 'max', 'disable-select'];
  }
  /**
   * constructor
   */
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `<style>
    :host {
      transform: translateZ(0) scale(0, 0);
      user-select: none;
    }
    .selected {
      background-color: #EEE;
    }
  </style>`;
    this._onScroll = this._onScroll.bind(this);
    this._onClick = this._onClick.bind(this);
  }
  /**
   * connectedCallback
   */
  connectedCallback() {
    // if (this.max && this.items && this.items.length > this.max) {
      this.style.overflowY = 'auto';
      this.addEventListener('scroll', this._onScroll, {capture: true});
    // }
    this.nameSpace = 'item';
    this[this.nameSpace] = [];
    this.shadowRoot.addEventListener('click', this._onClick, {capture: true});
  }
  /**
   * @param {string} value updates the 'name-space' attribute with given value.
   */
  set nameSpace(value) {
    if (value) {
      this.setAttribute('name-space', value);
    } else {
      this.removeAttribute('name-space');
    }
  }
  /**
   * @return {string} value of 'name-space' attribute
   */
  get nameSpace() {
    return this.getAttribute('name-space') || null;
  }
  /**
   * @param {string} value
   */
  set items(value) {
    this._items = this._validate(value);
    this.render();
  }
  /**
   * @param {number} value The number of items to display until scroll happened
   */
  set max(value) {
    this._max = this._validateMax(value);
  }
  /**
   * @param {array} value
   */
  set tasks(value) {
    this._tasks = value;
  }
  /**
   * @return {array} tasks
   */
  get tasks() {
    return this._tasks || [];
  }

  /**
   * @param {array} value
   */
  set calls(value) {
    this._calls = value;
  }
  /**
   * @return {array} tasks
   */
  get calls() {
    return this._calls || 0;
  }
  /**
   * @return {Array} [{}]
   */
  get items() {
    return this._items;
  }
  /**
   * @return {number} The number of items to display until scroll happens
   */
  get max() {
    return this._max || 10;
  }
  /**
   * @return {HTMLElement} template
   */
  get __itemTemplate() {
    let template = this.querySelector('template');
    if (template && template.localName === 'template') {
      this._itemTemplate = template;
      return template;
    } else {
      return null;
    }
  }
  /**
   * @return {HTMLElement} template
   */
  get itemTemplate() {
    return this._itemTemplate || this.__itemTemplate;
  }
  /**
   * @param {array} value style's defined in template
   * @private
   */
  set templateStyles(value) {
    this._templateStyles = value;
  }
  /**
   * @return {array} style's defined in template
   */
  get templateStyles() {
    return this._templateStyles || this.querySelectorAll('style');
  }
  /**
   * @return {boolean} wether or not the item-class-name attribute is present
   */
  get _hasItemClassName() {
    return this.hasAttribute('item-class-name');
  }
  /**
   * @return {string} className to add to the rendered items
   * @default 'item-class-name'
   */
  get itemClassName() {
    return this._hasItemClassName ? this.getAttribute('item-class-name') : 'array-repeat-item';
  }
  /**
   * @return {boolean} true when the disable-select attribute is used or
   * the disableSelect property is set to true.
   * @default false
   */
  get disableSelect() {
    return this._disableSelect || this.hasAttribute('disable-select');
  }
  /**
   * @param {boolean} value
   * @private
   */
  set disableSelect(value) {
    this._disableSelect = value;
  }
  /**
   * Attribute observer
   * @param {string} name the name of the attribute that changed
   *
   * @param {(string|object|array)} oldVal
   *  the previous value of the attribute that changed.
   *
   * @param {(string|object|array)} newVal
   *  the value of the attribute that changed.
   */
  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal !== newVal) {
      if (name === 'name-space') {
        if (oldVal) {
          delete this[this.previousNameSpace];
        } else if (newVal) {
          this[newVal] = [];
          this.previousNameSpace = newVal;
        }
      } else if (name === 'items') {
        this.items = JSON.parse(newVal);
      } else {
        this[this._toJsProp(name)] = newVal;
      }
    }
  }
  /**
   * @param {array|object} items
   * @return {array} items or error
   */
  _validate(items) {
    if (typeof items === 'object') {
      // when we have a length prop, the object is probably an array
      if (items.length) {
        return items;
      } else {
        return this._objectToArray(items);
      }
    }
    return console.error('items is not a typeof object');
  }
  /**
   * @param {number} max
   * @return {number} max or undefined
   */
  _validateMax(max) {
    max = Number(max);
    if (typeof max === 'NaN') {
      console.error('max is not a typeof number');
      return undefined;
    }
    return max;
  }
  /**
   * @param {object} object
   * @return {array} constructed array from object
   */
  _objectToArray(object) {
    let array = [];
    for (let prop of Object.keys(object)) {
      if (typeof object[prop] === 'object') {
        array.push(object[prop]);
      } else {
        array[prop] = object[prop];
      }
    }
    return array;
  }
  /**
   * forces an update
   */
  render() {
    this._itemTemplate = null;
    this._setupItems(this.items);
  }
  /**
   * @param {array} items A list with items to display.
   */
  _setupItems(items) {
    try {
      let promises = [];
      for (let item of items) {
        let itemTemplate = this.itemTemplate.cloneNode(true);
        let child = itemTemplate.content.children[0];
        let index = items.indexOf(item);
        child.classList.add(this.itemClassName);
        child.classList.add(`${ this.itemClassName }-${ index + 1 }`);
        child.dataset.index = index;
				item.index = index;
        promises.push(this._setupItem(itemTemplate.innerHTML, item));
      }

      Promise.all(promises).then(result => {
        this._constructInnerHTML(result).then(innerHTML => {
          this._setShadowRoot(innerHTML);
        });
      });
    } catch (error) {
      console.log(error);
    }
  }
  /**
   * @param {string} innerHTML
   * @param {array} item
   * @return {promise} promise
   */
  _setupItem(innerHTML, item) {
    this.tasks = [];
    let calls = 0;
    return new Promise((resolve, reject) => {
      this._forOf(item).then(tasks => {
        for (let task of tasks) {
          innerHTML = this._constructItemInnerHTML(task, innerHTML);
          calls += 1;
          if (tasks.length === calls) {
            resolve(innerHTML);
          }
        }
      });
    });
  }
  /**
   * @param {object} item
   * @param {string} inner the innerHTML to perform changes on
   * @return {string} innerHTML
   */
  _constructItemInnerHTML(item, inner) {
    item.name = `[[${ this.nameSpace }.${ item.key }]]`;
    const keys = inner.match(new RegExp(item.name, 'g'));
    if (keys) {
      for (let i = 0; i < keys.length; i++) {
        inner = inner.replace(item.name, item.value);
      }
    }
    return inner;
  }
  /**
   * custom for of loop that returns an array & reruns when an object is found
   * @param {object} item
   * @return {resolve} promises an array of tasks
   */
  _forOf(item) {
    return new Promise((resolve, reject) => {
      let oldKey;
      if (item.key) {
        oldKey = item.key;
        item = item.value;
      }
      for (let key of Object.keys(item)) {
        let _key = key;
        if (oldKey) {
          _key = `${ oldKey }.${ key }`;
        }
        if (typeof item[key] === 'object') {
          this._forOf({value: item[key], key: _key});
        } else {
          this.tasks.push({value: item[key], key: _key});
          this.tasks = this.tasks;
        }
        resolve(this.tasks);
      }
    });
  }
  /**
   * Constructs innerHTML with given array
   * @param {array} items the array to create a string from
   * @return {promise} promise
   */
  _constructInnerHTML(items) {
    return new Promise((resolve, reject) => {
      let innerHTML = '';
      let calls = 0;
      this.queriedCollection = undefined;
      for (let item of items) {
        calls += 1;
        innerHTML += item;
        if (this.max !== undefined && calls === this.max) {
          this._queryItems(items, this.max);
          return resolve(innerHTML);
        } else if (items.length === calls && this.max !== undefined && calls < this.max) {
          resolve(innerHTML);
        }
      }
    });
  }
  /**
   * Setup shadowRoot content
   * @param {string} innerHTML
   */
  _setShadowRoot(innerHTML) {
    this.shadowRoot.innerHTML = `<slot name="style"></slot>
  ${innerHTML}
  `;
    if (!this.renderedStyles) {
      this.renderedStyles = this.querySelectorAll('style');
    }
    for (let style of this.renderedStyles) {
      this.shadowRoot.appendChild(style).cloneNode(true);
    }
    this.itemHeight = this.shadowRoot.children[0].offsetHeight;
  }
  /**
   * Update shadowRoot content
   * @param {string} innerHTML
   */
  _updateShadowRoot(innerHTML) {
    let innerRoot = this.shadowRoot.innerHTML;
    innerRoot += innerHTML;
    requestAnimationFrame(() => {
      this.shadowRoot.innerHTML = innerRoot;
    });
  }
  /**
   * Queries items for contructing after scroll
   * @param {array} collection
   * @param {number} max
   */
  _queryItems(collection, max) {
    collection = collection.slice(max, collection.length);
    this.queriedCollection = collection;
  }
  /**
   * Updates the shadowRoot when there is an queriedCollection
   */
  _onScroll() {
    if (this.queriedCollection !== undefined) {
      this._constructInnerHTML(this.queriedCollection).then(innerHTML => {
        this._updateShadowRoot(innerHTML);
      });
    } else if (this.queriedCollection === undefined) {
      let timeout = () => {
        setTimeout(() => {
          if (this.queriedCollection !== undefined) {
            clearTimeout(timeout);
          } else {
            this.removeEventListener('scroll', this._onScroll);
          }

        }, 500);
      };
      timeout();
    }
  }

  _onClick(event) {
    let paths = event.path;
    for (let el of paths) {
      if (el.classList && el.classList.contains(this.itemClassName)) {
        let model = this.items[el.dataset.index];
        // event.target = path;
        if (!this.disableSelect) el.classList.add('selected');
        if (this.lastSelected && this.lastSelected !== el) {
          this.lastSelected.classList.remove('selected');
        }
        this.lastSelected = el;
        return this.dispatchEvent(new CustomEvent('custom-select', {detail: {target: el, data: model}}));
      }
    }
  }
  /**
   * Converts an attribute's name to an javascript property name
   * @param {string} string
   * @return {string} converted string
   */
  _toJsProp(string) {
    let parts = string.split('-');
    if (parts.length > 1) {
      let upper = parts[1].charAt(0).toUpperCase();
      string = parts[0] + upper + parts[1].slice(1).toLowerCase();
    }
    return string;
  }
}

customElements.define('array-repeat', ArrayRepeat);

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

export { GPU_ABI as G };
