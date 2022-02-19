class LittlePubSub {

  /**
   * Creates handlers
   */
  constructor(verbose = true) {
    this.subscribers = {};
    this.verbose = verbose;
  }

  /**
   * @param {String} event
   * @param {Method} handler
   * @param {HTMLElement} context
   */
  subscribe(event, handler, context) {
    if (typeof context === 'undefined') {
      context = handler;
    }
    this.subscribers[event] = this.subscribers[event] || { handlers: [], value: null};
    this.subscribers[event].handlers.push(handler.bind(context));
  }

  /**
   * @param {String} event
   * @param {Method} handler
   * @param {HTMLElement} context
   */
  unsubscribe(event, handler, context) {
    if (typeof context === 'undefined') {
      context = handler;
    }
    if (this.subscribers[event]) {
      const index = this.subscribers[event].handlers.indexOf(handler.bind(context));
      this.subscribers[event].handlers.splice(index);
      if (this.subscribers[event].handlers.length === 0) delete this.subscribers[event];
    }

  }

  /**
   * @param {String} event
   * @param {String|Number|Boolean|Object|Array} change
   */
  publish(event, change) {
    if (this.subscribers[event]) {
      if (this.verbose || this.subscribers[event].value !== change) {
        this.subscribers[event].value = change;
        this.subscribers[event].handlers.forEach(handler => {
          handler(change, this.subscribers[event].value);
        });
      }
    }
  }
}

class BaseClass$1 extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    if (this.template) this.shadowRoot.innerHTML = this.template;
  }

  sqs(query) {
    return this.shadowRoot.querySelector(query)
  }

  qs(query) {
    return this.querySelector(query)
  }
}

var helpers = {
  BaseClass: BaseClass$1
};

var html$1 = (strings, ...params) => {

  if (!Array.isArray(params)) params = [params];
  strings = strings.map((string, i) => params[i] ? string += params[i] : string);
  return strings.join('')
};

var utils = {
  html: html$1
};

/* from http://codepen.io/shyndman/pen/c5394ddf2e8b2a5c9185904b57421cdb */
const elevation2dp = `
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.14),
              0 1px 5px 0 rgba(0, 0, 0, 0.12),
              0 3px 1px -2px rgba(0, 0, 0, 0.2);`;

const elevation3dp = `
  box-shadow: 0 3px 4px 0 rgba(0, 0, 0, 0.14),
              0 1px 8px 0 rgba(0, 0, 0, 0.12),
              0 3px 3px -2px rgba(0, 0, 0, 0.4);`;

const elevation4dp = `
  box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14),
              0 1px 10px 0 rgba(0, 0, 0, 0.12),
              0 2px 4px -1px rgba(0, 0, 0, 0.4);`;

const elevation6dp = `
  box-shadow: 0 6px 10px 0 rgba(0, 0, 0, 0.14),
              0 1px 18px 0 rgba(0, 0, 0, 0.12),
              0 3px 5px -1px rgba(0, 0, 0, 0.4);`;

const elevation8dp = `
  box-shadow: 0 8px 10px 1px rgba(0, 0, 0, 0.14),
              0 3px 14px 2px rgba(0, 0, 0, 0.12),
              0 5px 5px -3px rgba(0, 0, 0, 0.4);`;

const elevation12dp = `
  box-shadow: 0 12px 16px 1px rgba(0, 0, 0, 0.14),
              0 4px 22px 3px rgba(0, 0, 0, 0.12),
              0 6px 7px -4px rgba(0, 0, 0, 0.4);`;

const elevation16dp = `
  box-shadow: 0 16px 24px 2px rgba(0, 0, 0, 0.14),
              0  6px 30px 5px rgba(0, 0, 0, 0.12),
              0  8px 10px -5px rgba(0, 0, 0, 0.4);`;

const elevation24dp = `
  box-shadow: 0 24px 38px 3px rgba(0, 0, 0, 0.14),
              0 9px 46px 8px rgba(0, 0, 0, 0.12),
              0 11px 15px -7px rgba(0, 0, 0, 0.4);`;

var elevation = {
  elevation2dp,
  elevation3dp,
  elevation4dp,
  elevation6dp,
  elevation8dp,
  elevation12dp,
  elevation16dp,
  elevation24dp
};

var styles = {
  elevation
};

var script = (src, integrity, crossorigin) => new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.onload = () => resolve();
  script.onerror = () => reject();
  script.src = src;
  script.setAttribute('async', '');
  if (integrity) script.setAttribute('integrity', integrity);
  if (crossorigin) script.setAttribute('crossorigin', crossorigin);

  document.head.appendChild(script);
});

var load = {
  script
};

const pubsub = globalThis.pubsub || new LittlePubSub();

var miniframe = {
  pubsub,
  helpers,
  utils,
  styles,
  load
};

globalThis.miniframe = miniframe;
globalThis.BaseClass = miniframe.helpers.BaseClass;
globalThis.html = miniframe.utils.html;
globalThis.pubsub = miniframe.pubsub;

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

/**
 * @extends HTMLElement
 */
((base = HTMLElement) => {
  window.svgIconset = window.svgIconset || {};

  customElements.define('custom-svg-iconset', class CustomSvgIconset extends base {
    /**
     * Attributes to observe
     *
     * Updates the js prop value with related attribute value
     * @return {array} ['name', 'theme', size]
     */
    static get observedAttributes() {
      return ['name', 'theme', 'size'];
    }
    /**
     * Runs whenever inserted into document
     */
    constructor() {
      super();
    }
    connectedCallback() {
      if (!this.hasAttribute('name')) {
        this.name = this.name;
      }
      this.style.display = 'none';
    }
    // Getters
    /**
     * The name of the iconset
     * @default {string} icons
     */
    get name() {
      return this._name || 'icons';
    }
    /**
     * The theme for the iconset
     * @default {string} light
     * @return {string}
     */
    get theme() {
      return this._theme || 'light';
    }
    /**
     * The size for the icons
     * @default {number} 24
     * @return {number}
     */
    get size() {
      return this._size || 24;
    }
    // Setters
    /**
     * Creates the iconset[name] in window
     */
    set name(value) {
      if (this._name !== value) {
        this._name = value;
        window.svgIconset[value] = {host: this, theme: this.theme};
        window.dispatchEvent(new CustomEvent('svg-iconset-update'));
        window.dispatchEvent(new CustomEvent('svg-iconset-added', {detail: value}));
      }
    }
    /**
     * Reruns applyIcon whenever a change has been detected
     */
    set theme(value) {
      if (this._theme !== value && this.name) {
        window.svgIconset[this.name] = {host: this, theme: value};
        window.dispatchEvent(new CustomEvent('svg-iconset-update'));
      }
      this._theme = value;
    }
    /**
     * @private
     */
    set size(value) {
      this._size = value;
    }
    /**
     * Runs whenever given attribute in observedAttributes has changed
     * @private
     */
    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal !== newVal) {
        this[name] = newVal;
      }
    }
    /* from https://github.com/PolymerElements/iron-iconset-svg */
    /**
     * Applies an icon to given element
     * @param {HTMLElement} element the element appending the icon to
     * @param {string} icon The name of the icon to show
     */
    applyIcon(element, icon) {
      element = element.shadowRoot || element;
      this.removeIcon(element);
      this._cloneIcon(icon).then(icon => {
        element.insertBefore(icon, element.childNodes[0]);
        element._iconSetIcon = icon;
      });
    }
    /**
     * Remove an icon from the given element by undoing the changes effected
     * by `applyIcon`.
     *
     * @param {Element} element The element from which the icon is removed.
     */
    removeIcon(element) {
      // Remove old svg element
      element = element.shadowRoot || element;
      if (element._iconSetIcon) {
        element.removeChild(element._iconSetIcon);
        element._iconSetIcon = null;
      }
    }
    /**
     * Produce installable clone of the SVG element matching `id` in this
     * iconset, or `undefined` if there is no matching element.
     *
     * @return {Element} Returns an installable clone of the SVG element
     * matching `id`.
     * @private
     */
    _cloneIcon(id) {
      return new Promise((resolve, reject) => {
        // create the icon map on-demand, since the iconset itself has no discrete
        // signal to know when it's children are fully parsed
        try {
          this._icons = this._icons || this._createIconMap();
          let svgClone = this._prepareSvgClone(this._icons[id], this.size);
          resolve(svgClone);
        } catch (error) {
          reject(error);
        }
      });
    }
    // TODO: Update icon-map on child changes
    /**
     * Create a map of child SVG elements by id.
     *
     * @return {!Object} Map of id's to SVG elements.
     * @private
     */
    _createIconMap() {
      var icons = Object.create(null);
      this.querySelectorAll('[id]')
        .forEach(icon => {
          icons[icon.id] = icon;
        });
      return icons;
    }
    /**
     * @private
     */
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

((base = HTMLElement) => {
  customElements.define('custom-svg-icon', class CustomSvgIcon extends base {

    /**
     * Attributes observer
     * @return {Array} ['icon']
     */
    static get observedAttributes() {
      return ['icon'];
    }

    /**
     * Iconset
     * @return {object} window.svgIconset
     * [checkout](svg-iconset.html) for more info.
     */
    get iconset() {
      return window.svgIconset
    }

    set iconset(value) {
      window.iconset = value;
    }

    /**
     * icon
     * @param {string} value icon to display.
     * optional: you can create multiple iconsets
     * by setting a different name on svg-iconset.
     *
     * **example:** ```html
     * <svg-iconset name="my-icons">
     *   <g id="menu">....</g>
     * </svg-iconset>
     * ```
     * This means we can ask for the icon using a prefix
     * **example:** ```html
     * <reef-icon-button icon="my-icons::menu"></reef-icon-button>
     * ```
     */
    set icon(value) {
      if (this.icon !== value) {
        this._icon = value;
        this.__iconChanged__({value: value});
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
      this.attachShadow({mode: 'open'});
      this._onIconsetReady = this._onIconsetReady.bind(this);
    }

    /**
     * Basic render template, can be called from host using super.render() or extended
     *
     * @example ```js
     * const iconTempl = super.template();
     * ```
     */
    render() {
      this.shadowRoot.innerHTML = this.template;
    }

    connectedCallback() {
      this.icon = this.getAttribute('icon') || null;
      if (!super.render) this.render();
    }

    _onIconsetReady() {
      window.removeEventListener('svg-iconset-added', this._onIconsetReady);
      this.__iconChanged__({value: this.icon});
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
      } else if(!change.value && this.iconset && this._icon) {
        let parts = this._icon.split('::');
        if (parts.length === 1) {
          this.iconset['icons'].host.removeIcon(this);
        } else {
          this.iconset[parts[0]].host.removeIcon(this);
        }
      }
      this.iconset = this.iconset;
    }

    /**
     * Runs when attribute changes.
     * @param {string} name The name of the attribute that changed.
     * @param {string|object|array} oldValue
     * @param {string|object|array} newValue
     */
    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue !== newValue) this[name] = newValue;
    }
  });
})();

var icons = html`
<custom-svg-iconset>
  <svg>
    <defs>
      <g id="add"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></g>
      <g id="clear"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></g>
      <g id="done"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"></path></g>
      <g id="search"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></g>
    </defs>
  </svg>
</custom-svg-iconset>`;

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

var pages = html`
<custom-pages attr-for-selected="data-route">
  <home-view data-route="home"></home-view>
  <connect-view data-route="connect"></connect-view>
  <buy-view data-route="buy"></buy-view>
</custom-pages>
`;

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
    this.innerHTML += '<span slot="content"></span>';
    this.shadowRoot.innerHTML = this._baseTemplate;

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
    const items = Array.from(this.querySelectorAll('.array-repeat-item'));
    if (items.length === this.items.length) return;
    this._queriedCollection = this._items.slice(items.length > 0 ? items.length - 1 : 0, items.length > 0 ? (items.length - 1) + this.max : this.max);
    if (this._queriedCollection.length > 0) this._runQue(this._queriedCollection);
  }

  _runQue(items) {
    for (let item of items) {
      const index = items.indexOf(item);
      item = this._forOf(item);
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
      this._content.appendChild(child);
    }
  }
  /**
   * custom for of loop that returns an array & reruns when an object is found
   * @param {object} item
   * @return {resolve} promises an array of tasks
   */
  _forOf(item) {
    let tasks = [];
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
        tasks = [...tasks, ...this._forOf({value: item[key], key: _key})];
      } else {
        tasks.push({value: item[key], key: _key});
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
        this.render();
      }, 500);
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

var shell = customElements.define('lottery-shell', class LotteryShell extends BaseClass {
  get _pages() {
    return this.sqs('custom-pages')
  }
  constructor() {
    super();
  }

  connectedCallback() {
    this.setTheme('default');
    this._select('home');
  }

  async _select(selected) {
    !await customElements.get(`${selected}-view`) && await import(`./${selected}.js`);
    this._previousSelected = this._pages.selected;
    this._pages.select(selected);
  }

  async setTheme(theme) {
    const importee = await import(`./themes/${theme}.js`);
    for (const prop of Object.keys(importee.default)) {
      document.querySelector('body').style.setProperty(`--${prop}`, importee.default[prop]);
    }
  }

  get template() {
    return html`
<style>
  * {
    user-select: none;
    pointer-events: none;
  }
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--main-background-color);
  }

  .logo {
    height: 32px;
    width: 32px;
    padding: 12px;
  }
</style>
${icons}
<flex-row center>
  <custom-svg-icon icon="menu"></custom-svg-icon>
  <flex-one></flex-one>
  <img class="logo" src="https://assets.artonline.site/arteon.svg"></img>
</flex-row>
${pages}
    `
  }
});

export { shell as default };
