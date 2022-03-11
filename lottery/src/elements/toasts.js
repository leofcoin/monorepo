export default customElements.define('custom-toasts', class CustomToasts extends BaseClass {
  constructor() {
    super()
  }

  async addToast(title, description) {
    const toast = document.createElement('custom-toast')
    this.appendChild(toast)
    const action = await toast.show(title, description)
    this.removeChild(this.querySelector('custom-toast'))
  }

  get template() {
    return html`
<style>
  :host {
    position: absolute;
    left: 0;
    bottom: 0;
    box-sizing: border-box;
    width: 240px;
    height: auto;
    padding-left: 24px;
    padding-bottom: 24px;
  }
</style>

<slot></slot>
    `
  }
})
