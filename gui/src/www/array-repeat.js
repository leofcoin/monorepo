/**
 * @class ArrayRepeat
 */
export default class ArrayRepeat extends HTMLElement {
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
    this.innerHTML += '<span slot="content"></span>'
    this.shadowRoot.innerHTML = this._baseTemplate

    this._onScroll = this._onScroll.bind(this);
    this._onClick = this._onClick.bind(this);
  }

  get _baseTemplate() {
    return `<style>
    :host {
      // transform: translateZ(0) scale(0, 0);
      user-select: none;
    }
    .selected {
      background-color: #EEE;
    }


  </style>

  <slot name="content"></slot>
  `
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
    return Number(this._max) || 10;
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

  get _content() {
    return this.querySelector('[slot="content"]')
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

    const items = Array.from(this.querySelectorAll('.array-repeat-item'))
    if (items.length === this._items.length) return;

    this._queriedCollection = this._items.splice(0, 10)
    if (this._queriedCollection.length > 0) this._runQue(this._queriedCollection)
  }

  _runQue(items) {
    for (let item of items) {
      const index = items.indexOf(item)
      item = this._forOf(item)
      let itemTemplate = this.itemTemplate.cloneNode(true);
      for (const { key, value } of item) {
        const name = `[[${ this.nameSpace }.${ key }]]`;
        const keys = itemTemplate.innerHTML.match(new RegExp(name, 'g'));
        if (keys) {
          for (let i = 0; i < keys.length; i++) {
            itemTemplate.innerHTML = itemTemplate.innerHTML.replace(name, value);
          }
        }
      }
      let child = itemTemplate.content.children[0];
      child.classList.add(this.itemClassName);
      child.classList.add(`${ this.itemClassName }-${ index + 1 }`);
      child.dataset.index = index;
      child.index = index;
      this._content.appendChild(child)
    }
  }

  reset() {

    this._queriedCollection = []
    this._items = []
    const children = this._content.innerHTML = ''
  }
  /**
   * custom for of loop that returns an array & reruns when an object is found
   * @param {object} item
   * @return {resolve} promises an array of tasks
   */
  _forOf(item) {
    let tasks = []
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
        tasks = [...tasks, ...this._forOf({value: item[key], key: _key})]
      } else {
        tasks.push({value: item[key], key: _key})
      }
    }
    return tasks
  }
  /**
   * Updates the shadowRoot when there is an queriedCollection
   */
  async _onScroll() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout =
      setTimeout(() => {
        this.render()
      }, 500)
  }

  _onClick(event) {
    let paths = event.composedPath();
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
