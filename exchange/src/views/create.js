import './../animations/loading'
import './../elements/upload-asset'
import controller from './../../../elements/ipfs-controller/controller'
import CREATEABLES from './../../../abis/createables'

export default customElements.define('create-view', class CreateView extends BaseClass {

  get _uploadAsset() {
    return this.shadowRoot.querySelector('upload-asset')
  }

  get _description() {
    return this.shadowRoot.querySelector('[name="description"]')
  }

  get _name() {
    return this.shadowRoot.querySelector('[name="name"]')
  }

  get _externalLink() {
    return this.shadowRoot.querySelector('[name="external link"]')
  }

  get _add() {
    return this.shadowRoot.querySelector('[icon="add"]')
  }

  constructor() {
    super()
    this._onchange = this._onchange.bind(this)
    this._onadd = this._onadd.bind(this)
    this._onuploadAsset = this._onuploadAsset.bind(this)

    this._confirm = this._confirm.bind(this)
  }

  connectedCallback() {
    this._uploadAsset.addEventListener('upload-asset', this._onuploadAsset)
    const inputs = Array.from(this.shadowRoot.querySelectorAll('custom-input'))
    inputs.push(this.shadowRoot.querySelector('textarea'))
    inputs.forEach((input, i) => {
      if (input.getAttribute('name') !== 'external link') input.addEventListener('input', this._onchange)
    });

    this._add.addEventListener('click', this._onadd)
    this.shadowRoot.querySelector('button').addEventListener('click', this._confirm)

    controller()
  }

  _onchange() {
    if (this.timeout) clearTimeout(this.timeout)

    this.timeout = setTimeout(() => {
      this._validate()
    }, 300);

  }

  async _onadd() {
    const name = await prompt('How to call the section?')
    const strong = document.createElement('strong')
    strong.innerHTML = name
    const input = document.createElement('custom-input')
    input.setAttribute('name', name)
    input.setAttribute('placeholder', name)
    input.setAttribute('title', name)

    this.shadowRoot.querySelector('.container').insertBefore(strong, this.shadowRoot.querySelector('.add-wrapper'))
    this.shadowRoot.querySelector('.container').insertBefore(input, this.shadowRoot.querySelector('.add-wrapper'))
  }

  _readFile(file, is) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result)
      if (is === 'buffer') {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsDataURL(file)
      }
    })

  }

  async _onuploadAsset({detail}) {

    this._imgBuffer = await this._readFile(detail, 'buffer')
    this._img = await this._readFile(detail)
    this._uploadAsset.shadowRoot.querySelector('.preview').innerHTML = `<img src="${this._img}"></img>`
    this._validate()
  }

  _validate() {
    if (this._img &&
        this._imgBuffer &&
        this._description.value &&
        this._name.value
      ) this.setAttribute('enabled', '')
   else this.removeAttribute('enabled')

  }

  async _confirm() {
    await controller()

    let value = await ipfs.add(this._imgBuffer)
    const image = `https://ipfs.io/ipfs/${value.cid.toString()}`

    const json = {
      name: this._name.value,
      description: this._description.value,
      image
    }

    let inputs = Array.from(this.shadowRoot.querySelectorAll('custom-input'))
    inputs = inputs.forEach((input) => {
      if (input.getAttribute('name') !== 'name' && input.getAttribute('name') !== 'image') {
        json[input.getAttribute('name')] = input.value
      }
    })
    value = await ipfs.add(JSON.stringify(json, null, '\t'))
    console.log(value.cid.toString());
    if (!api.connection) {
      await api.connectWallet()
    }
    const contract = new ethers.Contract(api.addresses.createables, CREATEABLES, api.connection.provider.getSigner())
    const tx = contract.create(api.connection.accounts[0], value.cid.toString())
    await tx.wait()
  }

  get template() {
    return html`
    <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          padding: 12px;
          align-items: center;
          justify-content: center;
          --svg-icon-color: var(--secondary-color);
        }

        .container {
          display: flex;
          flex-direction: column;
          padding: 12px 0;
          height: 100%;
          box-sizing: border-box;
          overflow-y: auto;
          pointer-events: auto;
        }

        .hero {
          display: flex;
          flex-direction: column;
          width: 320px;
          max-height: 640px;
          height: 100%;
          padding: 12px 24px;
          color: var(--main-color);
          background: var(--main-background-color);
          box-shadow: 0 1px 18px 0px var(--accent-color);
          border-radius: 24px;
        }

        custom-input, textarea {
          box-shadow: 0px 1px 3px -1px #333;
          pointer-events: auto;
          border-radius: 12px;
          margin: 12px 0;
          --custom-input-color: var(--secondary-color);
        }

        flex-column {
          padding: 0 12px;
          box-sizing: border-box;
        }

        flex-wrap-around {
          width: 100%;
        }

        custom-tab, custom-svg-icon {
          pointer-events: auto;
          cursor: pointer;
        }
        strong {
          margin: 0;
          padding-top: 12px;
        }
        h2 {
          margin-top: 0;
        }
        textarea {
          --webkit-visibility: none;
          border: none;
          background: transparent;
          height: var(--custom-input-height, 48px);
          width: 100%;
          box-sizing: border-box;
          padding: 10px;
          color: var(--custom-input-color, #555);
          outline: var(--custom-input-outline);
          min-height: 48px;
        }

        ::placeholder {
          color: var(--custom-input-placeholder-color, --custom-input-color);
        }

        .confirm {
          color: #eee;
          background: #555;
        }

        :host([enabled]) .confirm {
          background: var(--accent-color);
          pointer-events: auto;
        }
    </style>
    <span class="hero">
      <h2 slot="title">create</h2>
      <span class="container">
        <flex-row>
          <flex-one></flex-one>
          <upload-asset></upload-asset>
          <flex-one></flex-one>
        </flex-row>
        <strong>name</strong>
        <custom-input name="name" placeholder="name"></custom-input>
        <strong>external link (optional)</strong>
        <custom-input name="external link" placeholder="https://somesite.domain/myNFT" title="external link"></custom-input>
        <strong>description</strong>
        <textarea type="text" name="description" placeholder="description"></textarea>

        <flex-row class="add-wrapper">
          <flex-one></flex-one>
          <custom-svg-icon icon="add"></custom-svg-icon>
          <flex-one></flex-one>
        </flex-row>
      </span>

      <flex-one></flex-one>
      <button class="confirm">create</button>
    </span>
    `
  }
})
