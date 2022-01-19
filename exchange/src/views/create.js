import './../animations/loading'

export default customElements.define('create-view', class CreateView extends BaseClass {
  constructor() {
    super()
  }

  get template() {
    return html`
    <style>
      :host {
        width: 100%;
        height: 100%;
        color: var(--main-color);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 40px;
      }

      flex-column {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        align-items: baseline;
      }
    </style>
    <loading-animation></loading-animation>
    <flex-column>
      <h6>soon</h6>
    </flex-column>
    `
  }
})
