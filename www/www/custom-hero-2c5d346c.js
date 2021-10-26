customElements.define('custom-hero', class customHero extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          padding: 24px;
          box-sizing: border-box;
          max-width: 320px;
          max-height: 320px;
          width: 100%;
          height: 100%;
          border: 1px solid #111;
          border-radius: 24px;
          background: aliceblue;
        }
      </style>
      <slot></slot>
    `;
  }
});
