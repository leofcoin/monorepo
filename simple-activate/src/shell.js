import PubSub from './../../node_modules/@vandeurenglenn/little-pubsub/src/index'
import './../../elements/arteon-connect/src/arteon-connect'
import Api from './../../api/src/api'
import './../../elements/gpu-select/src/gpu-select'
import './../../elements/gpu-img/src/gpu-img'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-column'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-row'
import './../node_modules/@vandeurenglenn/flex-elements/src/flex-one'
import './../node_modules/@arteon/wallet-connect/dist/wallet-connect.browser'

globalThis.pubsub = new PubSub()

let MINE_ABI
let GPU_ABI
export default customElements.define('simple-activate-shell', class SimpleActivateShell extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this._onGpuSelected = this._onGpuSelected.bind(this);
    this._onconnect = this._onconnect.bind(this)
    this._onclick = this._onclick.bind(this)

    pubsub.subscribe('connect', this._onconnect);
    (async () => {

      globalThis.api = await new Api({name: 'mainnet'})
      await import('./third-party/ethers.js')

      this.shadowRoot.innerHTML = `
        <style>
          * {
            pointer-events: none;
          }
          :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
          }
          flex-row, button {
            padding: 6px;
            box-sizing: border-box;
          }

          button, input {
            pointer-events: auto;
          }
        </style>
        <flex-column>
          <gpu-img></gpu-img>

          <flex-row>
            <strong>gpu</strong>
            <flex-one></flex-one>
            <gpu-select></gpu-select>
          </flex-row>

          <flex-row>
            <strong>earned</strong>
            <flex-one></flex-one>
            <span class="earned"></span>
          </flex-row>

          <flex-column>
            <flex-row>
              <strong>balance</strong>
              <flex-one></flex-one>
              <span class="balance"></span>
            </flex-row>

            <flex-row>
              <strong>mining</strong>
              <flex-one></flex-one>
              <span class="mining"></span>
            </flex-row>
          </flex-column>

          <flex-column>
            <flex-row>
              <input placeholder="id"></input>
              <flex-one></flex-one>
              <button data-action="activate">activate</button>
              <button data-action="deactivate">deactivate</button>
            </flex-row>

            <flex-row>
              <flex-one></flex-one>
              <button data-action="reward">get reward</button>
              <flex-one></flex-one>
            </flex-row>

          </flex-column>
        </flex-column>
      `
      this._img.symbol = 'GENESIS'

      this._select._select.addEventListener('selected', this._onGpuSelected)
      this.addEventListener('click', this._onclick)
    })()

  }

  get _img() {
    return this.shadowRoot.querySelector('gpu-img')
  }

  get _select() {
    return this.shadowRoot.querySelector('gpu-select')
  }

  get _input() {
    return this.shadowRoot.querySelector('input')
  }

  set balance(value) {
    this.shadowRoot.querySelector('.balance').innerHTML = value.toString()
  }

  set mining(value) {
    this.shadowRoot.querySelector('.mining').innerHTML = value.toString()
  }

  set earned(value) {
    value = ethers.utils.formatUnits(value).toString()
    value = value.split('.')
    value = `${value[0]} . ${value[1].slice(0, 2)}`
    this.shadowRoot.querySelector('.earned').innerHTML = value
  }

  async _onclick(event) {
    const target = event.composedPath()[0]
    if (target.hasAttribute('data-action')) {
      const id = this._input.value
      const action = target.getAttribute('data-action')
      if (action === 'activate') {
        let mine;
        let approved;
        try {
          approved = await this.gpuContract.callStatic.isApprovedForAll(api.address, this.miningContract.address)
        } catch (e) {
          approved = await this.gpuContract.callStatic.getApproved(id)
        }
        try {
          if (approved === false) {
            const tx = await this.gpuContract.setApprovalForAll(this.miningContract.address, true)
            await tx.wait()
          }
          if (typeof approved !== 'boolean' && approved !== this.miningContract.address) {
            approved = await this.gpuContract.approve(this.miningContract.address, id)
            await approved.wait()
          }
          mine = await this.miningContract.activateGPU(id)
          await mine.wait()

          alert(`activated: ${id}`)
        } catch (e) {
          alert(e)
          // const gasLimit = Number(e.message.match(/want \d*/)[0].replace('want ', '')) + 5000
          // mine = await this.contract.mine(Number(id), {gasLimit})
        }
        return
      }
      if (action === 'deactivate') {
        try {
          let mine = await this.miningContract.functions.deactivateGPU(id)
          await mine.wait()
          alert(`deactivated: ${id}`)
        } catch (e) {
          alert(e)
        }
        return
      }
      if (action === 'reward') {
        try {
          const tx = await this.miningContract.functions.getReward()
          await tx.wait()
          alert('reward transfer success')
        } catch (e) {
          alert('reward transfer failure')
        }
      }
    }
  }

  async _onconnect() {

    this.setAttribute('animate-in', '')
    const connected = await walletConnect.connect('mainnet')
    api.provider = connected.provider
    api.address = connected.accounts[0]
    api.signer = api.provider.getSigner(0)
    let importee = await import('./../../abis/pool.js')
    this.poolContract = api.getContract(api.addresses.factory, importee.default)
    const token = await this.poolContract.callStatic.listedTokens(0)
    importee = await import('./../../abis/miner.js')
    MINE_ABI = importee.default
    this.miningContract = api.getContract(token, MINE_ABI, true)
    const gpuAddress = await this.miningContract.callStatic.ARTEON_GPU()
    importee = await import('./../../abis/gpu.js')
    GPU_ABI = importee.default
    this.gpuContract = api.getContract(gpuAddress, GPU_ABI, true)
    this._select.selected = 'GENESIS'
    this.balance = await this.gpuContract.callStatic.balanceOf(api.address)
    this.mining = await this.miningContract.callStatic.balanceOf(api.address)
    this.earned = await this.miningContract.callStatic.earned()
    this._startEarnedTimer()
  }

  _startEarnedTimer() {
    if (this.timeout) clearTimeout(this.timeout)

    this.timeout = () => setTimeout(async () => {
      this.earned = await this.miningContract.callStatic.earned()
      this.timeout()
    }, 10000);

    this.timeout()
  }

  async _onGpuSelected({detail}) {
    const selected = this._select.shadowRoot.querySelector(`[data-route="${detail}"]`)
    this._img.symbol = detail.includes('artx') ?
      detail.replace('artx', 'ARTX ') : detail.toUpperCase()

    const token = await this.poolContract.callStatic.listedTokens(selected.dataset.index)

    this.miningContract = api.getContract(token, MINE_ABI, true)
    const gpuAddress = await this.miningContract.callStatic.ARTEON_GPU()
    this.gpuContract = api.getContract(gpuAddress, GPU_ABI, true)

    this.balance = await this.gpuContract.callStatic.balanceOf(api.address)
    this.mining = await this.miningContract.callStatic.balanceOf(api.address)
    this.earned = await this.miningContract.callStatic.earned()
    this._startEarnedTimer()
  }

  async _getReward() {
    this.rewardPerGPU = await this.contract.callstatic.rewardPerGPU()
  }
})
