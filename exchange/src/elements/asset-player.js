export default customElements.define('asset-player', class AssetPlayer extends BaseClass {
  static get observedAttributes() {
    return ['src']
  }
  constructor() {
    super()
  }

  attributeChangedCallback(name, old, value) {
    if (value && old !== value) this[name] = value
  }

  get _video() {
    return this.shadowRoot.querySelector('video')
  }

  get _img() {
    return this.shadowRoot.querySelector('img')
  }

  set src(value) {
    if (value.includes('.mp4')) {
      this._img.setAttribute('hidden', '')
      const source = document.createElement('source')
      source.src = value
      this._video.appendChild(source)
      this._video.removeAttribute('hidden')
    } else {
      this._video.setAttribute('hidden', '')
      this._img.src = value
      this._img.removeAttribute('hidden')
    }
  }

  get template() {
    return html`
    <style>
      :host {
        display: flex;
        height: 100%;
        width: 100%;
        border-radius: 12px;
        max-height: 150px;
        overflow: hidden;
        background: #000;
        ${miniframe.styles.elevation.elevation6dp}
      }
      img, video {
        height: 100%;
        width: 100%;
        opacity: 1;
      }

      [hidden] {
        opacity: 0;
      }
    </style>
    <img></img>
    <video autoplay="true" loop="true" muted="true"></video>
    `
  }
})
