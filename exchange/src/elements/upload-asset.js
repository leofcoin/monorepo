export default customElements.define('upload-asset', class UploadAsset extends BaseClass {
  get input() {
    return this.shadowRoot.querySelector('input')
  }
  constructor() {
    super()
    this._ondragover = this._ondragover.bind(this);
    this._ondrop = this._ondrop.bind(this);
    this._onclick = this._onclick.bind(this);
    this._dispatchEvent = this._dispatchEvent.bind(this);
  }

  connectedCallback() {
    this.addEventListener('drop', this._ondrop);
    this.addEventListener('dragover', this._ondragover);

    this.input.onchange = () => {
      // for (let i = 0; i < this.input.files.length; ++i) {
      this._dispatchEvent(this.input.files[0]);
      // }
    };

    this.addEventListener('click', this._onclick)
  }

  _onclick() {
    this.input.click()
  }

  _dispatchEvent(result) {
    this.dispatchEvent(new CustomEvent('upload-asset', {
      detail: result
    }))
  }

  _ondragover(event) {
    event.preventDefault();
  }

  _ondrop(event) {
    console.log('File(s) dropped');
    // Prevent default behavior (Prevent file from being opened)
    event.preventDefault();

    if (event.dataTransfer.items) {
      // for (var i = 0; i < event.dataTransfer.items.length; i++) {
      if (event.dataTransfer.items[0].kind === 'file') {
        this._dispatchEvent(event.dataTransfer.items[0].getAsFile());
      }
      // }
    } else {
      // for (var i = 0; i < event.dataTransfer.files.length; i++) {
      this._dispatchEvent(event.dataTransfer.files[0]);
      // }
    }
  }

  get template() {
    return html`
    <style>
      :host {
        position: relative;
        display: flex;
        height: 128px;
        width: 128px;
        border: 1px solid #eee;
        border-radius: 12px;
        pointer-events: auto;
        overflow: hidden;
      }

      flex-column, .preview {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        align-items: center;
        justify-content: center;
        height: 128px;
        width: 128px;
      }

      input {
        opacity: 0;
        pointer-events: none;
      }

      img {
        width: 100%;
      }
    </style>
    <input type="file" accept="image/*"></input>
    <flex-column>
      <custom-svg-icon icon="camera"></custom-svg-icon>
      <strong>upload</strong>
      <strong>image</strong>
    </flex-column>

    <span class="preview"></span>



    `
  }
})
