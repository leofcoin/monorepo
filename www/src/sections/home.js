export default customElements.define('home-section', class HomeSection extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      video {
        position: absolute;
        top: -290px;
        width: 100%;
      }
    </style>
    <video autoplay="" loop="" muted="" playsinline=""><source src="./assets/Comp_1.mp4" type="video/mp4"></video>
    `
  }
})
