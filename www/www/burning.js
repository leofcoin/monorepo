var burning = customElements.define('burning-section', class BurningSection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        position: relative;
        width: 100%;
        height: 582px;
      }
    </style>
    `
  }
});

export { burning as default };
