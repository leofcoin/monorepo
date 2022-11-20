import { version } from './../../../package.json'

export default customElements.define('validator-view', class ValidatorView extends HTMLElement {
  #validators = []

  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }


  async connectedCallback() {
    this.#validators = await api.validators()
    this.shadowRoot.querySelector('.total-validators').innerHTML = this.#validators.length

    this.shadowRoot.querySelector('button').addEventListener('click', () => api.participate())
  }

  get template() {
    return `
<style>
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
  }



</style>

<flex-row>
  <strong>validators</strong>
  <flex-one></flex-one>
  <span class="total-validators"></span>
</flex-row>

<button>participate</button>
    `
  }
})
