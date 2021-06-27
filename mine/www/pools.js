import { G as GPU_ABI } from './custom-input-bb0a41e0.js';
import { e as elevation2dp } from './elevation-f8af9a6d.js';

var MINER_ABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "gpu",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "blockTime",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "maxReward",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Activate",
		"type": "event",
		"signature": "0xfbd0a3f6e9a0dd5f834515748047e83de8064477489a0a0d6b59c64bbecc992a"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Deactivate",
		"type": "event",
		"signature": "0x13b865880a841dc469b629159fa1e730fee99568b0decc6737fd688b36246381"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "previousOwner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event",
		"signature": "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "reward",
				"type": "uint256"
			}
		],
		"name": "Reward",
		"type": "event",
		"signature": "0x619caafabdd75649b302ba8419e48cccf64f37f1983ac4727cfb38b57703ffc9"
	},
	{
		"inputs": [],
		"name": "ARTEON_GPU",
		"outputs": [
			{
				"internalType": "contract ArteonGPU",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0xc1a75d9e"
	},
	{
		"inputs": [],
		"name": "ARTEON_TOKEN",
		"outputs": [
			{
				"internalType": "contract Arteon",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0xf9f680db"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "activateGPU",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x8c359f4b"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x70a08231"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "deactivateGPU",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x9e570729"
	},
	{
		"inputs": [],
		"name": "earned",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0xd6f19262"
	},
	{
		"inputs": [],
		"name": "getMaxReward",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0xc213f3f9"
	},
	{
		"inputs": [],
		"name": "getReward",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x3d18b912"
	},
	{
		"inputs": [],
		"name": "miners",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x5ee0aca0"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "bytes",
				"name": "",
				"type": "bytes"
			}
		],
		"name": "onERC721Received",
		"outputs": [
			{
				"internalType": "bytes4",
				"name": "",
				"type": "bytes4"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x150b7a02"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x8da5cb5b"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ownerOf",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x6352211e"
	},
	{
		"inputs": [],
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x715018a6"
	},
	{
		"inputs": [],
		"name": "rewardPerGPU",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0xd717a393"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "rewards",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x0700037d"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x01ffc9a7"
	},
	{
		"inputs": [],
		"name": "totalSupply",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0x18160ddd"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0xf2fde38b"
	}
];

customElements.define('nft-pool-cards', class NFTPoolCards extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;

    this._contracts = [];
  }

  async _load(cards) {
    console.log(cards);
      this.innerHTML = '';

    for (const id of cards) {
      const span = document.createElement('span');
      span.innerHTML = `<custom-svg-icon icon="fan"></custom-svg-icon>
      <strong>${id}</strong>
      <span class="flex"></span>
      <button data-action="mine" data-id="${id}">mine</button>
      `;

      this.appendChild(span);
    }
  }
// hardware:toys
  get template() {
    return `
    <style>
      :host {
        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        width: 100%;
        padding-top: 48px;
        box-sizing: border-box;
        overflow-y: auto;
      }

      section {
        display: flex;
        align-items: center;
      }

      ::slotted(span) {
        display: flex;
        width: 100%;
        align-items: center;
      }
    </style>
    <slot></slot>
    `
  }
});

globalThis._contracts = globalThis._contracts || [];

customElements.define('nft-pool', class NFTPool extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;

    this._onclick = this._onclick.bind(this);
  }

  connectedCallback() {
    this.addEventListener('click', this._onclick);
  }

  set address(value) {
    if (this.address !== value) this._load(value);
  }

  get address() {
    return this._address
  }

  async showAddDialog() {
    const result = await prompt('enter gpu (token) ID');
    if (!result) return
    let cards = await localStorage.getItem(`arteon-gpu-${this.symbol}-${api.chainId}`);
    cards = cards ? JSON.parse(cards) : [];
    cards.push(result);
    await localStorage.setItem(`arteon-gpu-${this.symbol}-${api.chainId}`, JSON.stringify(cards));
    console.log(result);
  }

  async _onclick(event) {
    const target = event.composedPath()[0];
    if (!target.hasAttribute('data-action')) return

    const action = target.getAttribute('data-action');

    if (action === 'add') {
      const balance = await this.gpuContract.callStatic.balanceOf(api.signer.address);
      if (balance.toNumber() === 0) return this.showBalanceDialog()

      return this.showAddDialog()
    }

    const id = target.dataset.id;
    console.log(id);
    if (action === 'mine') {
      let mine;
      try {
        let approved = await this.gpuContract.callStatic.getApproved(id);
        if (approved !== this.contract.address) {
          approved = await this.gpuContract.approve(this.contract.address, id);
          await approved.wait();
        }
        mine = await this.contract.functions.activateGPU(id);
      } catch (e) {
        console.error(e);
        // const gasLimit = Number(e.message.match(/want \d*/)[0].replace('want ', '')) + 5000
        // mine = await this.contract.mine(Number(id), {gasLimit})
      }
      console.log(mine);
      return
    }

    if (action === 'deactivate') {
      return
    }

    this.showBuyDialog();


  }

  async _load(address) {
    console.log(address);
    this._address = address;
    this.contract = globalThis._contracts[address] ? globalThis._contracts[address] : new ethers.Contract(address, MINER_ABI, api.signer);
    const gpuAddress = await this.contract.callStatic.ARTEON_GPU();
    this.gpuContract = new ethers.Contract(gpuAddress, GPU_ABI, api.signer);
    const symbol = await this.gpuContract.callStatic.symbol();
    this.symbol = symbol;


    let cards = await localStorage.getItem(`arteon-gpu-${this.symbol}-${api.chainId}`);
    cards = cards ? JSON.parse(cards) : [];

    // promises = []
    // let i = 0;
    // let nonce = await api.signer.provider.getTransactionCount(api.signer.address);
    // for (const card of cards) {
    //   nonce++
    //   promises.push(this.contract.ownerOf(card, { nonce }))
    // }
    //
    // promises = await Promise.allSettled(promises)
    // console.log(promises[0]);
    // // TODO: test on owner transfer
    // const notOwned = promises.filter(promise => promise.value ? promise.value !== api.signer.address : true)
    // console.log(notOwned);
    // for (const {value} of notOwned) {
    //   const index = promises.indexOf(value)
    //   promises.splice(index, 1)
    //   cards.splice(index, 1)
    // }
    await localStorage.setItem(`arteon-gpu-${this.symbol}`, JSON.stringify(cards));
    this.shadowRoot.querySelector('nft-pool-cards')._load(cards);
    this.shadowRoot.querySelector('pool-selector-item').setAttribute('address', address);
    console.log(cards);
    console.log(promises);
  }

  get template() {
    return `
    <style>
      :host {
        color: var(--main-color);
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        --svg-icon-color: #eee;
      }

      video {
        // max-width: 320px;
        // width: 100%;
        max-height: 320px;
      }

      section {
        display: flex;
        flex-direction: column;
        max-height: 480px;
        align-items: center;
      }

      summary {
        display: flex;
        flex-direction: column;
        padding: 24px 0 24px 24px;
        box-sizing: border-box;
      }

      button {
        background: transparent;
        box-sizing: border-box;
        padding: 6px 24px;
        color: var(--main-color);
        border-color: var(--accent-color);
      }

      .row {
        display: flex;
        width: 100%;
        max-width: 320px;
        box-sizing: border-box;
        padding: 12px 24px;
      }

      nft-pool-cards {
      box-sizing: border-box;
      padding: 12px 24px 24px 24px;
      }

      .flex {
        flex: 1;
      }

      h6 {
        margin: 0;
      }

      custom-svg-icon[icon="close"] {
        position: absolute;
        top: 12px;
        right: 24px;
        --svg-icon-size: 24px;
        box-sizing: border-box;
      }

      pool-selector-item {
        background: inherit;
        color: var(--main-color);
      }
      .toolbar {
        width: 100%;
        height: 40px;
        align-items: center;
        padding: 0 24px;
        box-sizing: border-box;
      }
    </style>

    <section>
      <custom-svg-icon icon="close" data-route="back"></custom-svg-icon>
      <pool-selector-item></pool-selector-item>

    </section>
    <nft-pool-cards></nft-pool-cards>

    <span class="row">
      <button data-action="add">add</button>

      <span class="flex"></span>
    </span>
    `
  }
});

customElements.define('arteon-button', class ArteonButton extends HTMLElement {
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
        height: 40px;
        min-width: 86px;
      }
      button {
        display: flex;
        align-items: center;
        background: transparent;
        box-sizing: border-box;
        padding: 6px 24px;
        color: var(--main-color);
        border-color: var(--accent-color);
        border-radius: 12px;
        height: inherit;
        min-width: inherit;
      }
    </style>
    <button><slot></slot></button>
      `
  }
});

customElements.define('pool-selector-item', class PoolSelectorItem extends HTMLElement {
  static get observedAttributes() {
    return ['address']
  }

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
  }

  connectedCallback() {
    if (!this.address) this.address = this.getAttribute('address');
  }

  attributeChangedCallback(name, old, value) {
    if(value !== old || !this[name]) this[name] = value;
  }

  set address(address) {
    this._address = address;
    globalThis._contracts[address] = globalThis._contracts[address] || new ethers.Contract(address, MINER_ABI, api.signer);
    this._render(address);
  }

  get address() {
    return this._address
  }

  async _render(address) {
    let contract = globalThis._contracts[address];
    let promises = [
      contract.callStatic.ARTEON_GPU(),
      contract.callStatic.miners(),
      contract.callStatic.getMaxReward(),
      contract.callStatic.earned()
    ];

    promises = await Promise.all(promises);
    globalThis._contracts[promises[0]] = globalThis._contracts[promises[0]] || new ethers.Contract(promises[0], GPU_ABI, api.signer);

    this.symbol = await globalThis._contracts[promises[0]].callStatic.symbol();
    this.miners = promises[1];
    this.maxReward = ethers.utils.formatUnits(promises[2], 18);
    this.earned = ethers.utils.formatUnits(promises[3], 18);
    this.maxRewardShort = Math.round(Number(this.maxReward * 1000)) / 1000;
    this.earnedShort = Math.round(Number(this.earned * 1000)) / 1000;

    this.difficulty = (this.miners / api.maximumSupply[this.symbol]);
    // this.rewards = promises[4]
    // this.URI = `https://nft.arteon.org/cards/${api.assets[this.symbol]}`
    this.URI = api.assets[this.symbol];
    // promises = [
      // contract
      // contract.callStatic.maxReward(),
      // contract.callStatic.earned(),
      // contract.callStatic.rewards(api.signer.address)
    // ]
    console.log({...promises});
    this.shadowRoot.innerHTML = this.template;
  }
// hardware:toys
  get template() {
    return `
    <style>
      * {
        pointer-events: none;
      }
      :host {
        color: var(--main-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        border-bottom: 1px solid #333;
        box-sizing: border-box;
        // padding: 12px 48px 12px 48px;
        padding: 0 24px 12px 24px;
        background: #eee;
        color: #333;
        pointer-events: auto;
      }
      h4 {
        margin: 0;
        padding: 14px 0 44px 0;
        box-sizing: border-box;
      }
      img {
        margin-top: 24px;
        width: 320px;
      }

      flex-row {
        width: 100%;
      }

      .explainer {
        padding: 0 6px;
      }

      custom-svg-icon {
        margin-left: 12px;
      }

      @media (max-width: 840px) {
        flex-row[data-route="overview"] {
          flex-direction: column !important;
          align-items: center;
        }
      }
    </style>
      <flex-row data-route="overview">
        <flex-column style="width: 100%;">
          <h4><strong>${this.symbol}</strong></h4>
          <flex-row>
            <custom-svg-icon icon="memory"></custom-svg-icon>
            <span class="explainer">miners</span>
            <flex-one></flex-one>
            <span>${this.miners}</span>
          </flex-row>
          <flex-row>
            <custom-svg-icon icon="compare-arrows"></custom-svg-icon>
            <span class="explainer">maxReward</span>
            <flex-one></flex-one>
            <span title="${this.maxReward}">${this.maxRewardShort}</span>
          </flex-row>
          <flex-row>
            <custom-svg-icon icon="build"></custom-svg-icon>
            <span class="explainer">difficulty</span>
            <flex-one></flex-one>
            <span>${this.difficulty}</span>
          </flex-row>
          <flex-row>
            <custom-svg-icon icon="attach-money"></custom-svg-icon>
            <span class="explainer">earned</span>
            <flex-one></flex-one>
            <span title="${this.earned}">${this.earnedShort}</span>
          </flex-row>
          <flex-one></flex-one>
        </flex-column>
        <img src="${this.URI}" loading="lazy"></img>

      </flex-row>
      <!-- <custom-svg-icon icon="arrow-drop-down"></custom-svg-icon> -->
    `
  }
});

customElements.define('pool-selector', class PoolSelector extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;

    this._select = this._select.bind(this);
  }

  connectedCallback() {
    this._load();

    this.addEventListener('click', this._select);
  }

  get _pages() {
    return this.shadowRoot.querySelector('custom-pages')
  }

  get _arrayRepeat() {
    return this.shadowRoot.querySelector('array-repeat')
  }

  async _load() {
    Object.keys(api.addresses.pools).map(key => api.addresses.pools[key]);



    this._arrayRepeat.items = Object.keys(api.addresses.pools).map(key => {
      return {address: api.addresses.pools[key]}
    });
  }

  _select(event) {
    const target = event.composedPath()[0];
    const route = target.getAttribute('data-route');
    if (route && target.hasAttribute('address')) {
      this._pages.select('pool');
      this.shadowRoot.querySelector('nft-pool')._load(target.getAttribute('address'));
      return
    }
    if (route === 'overview' || route === 'back') this._pages.select('overview');
  }
// hardware:toys
  get template() {
    return `
    <style>
      :host {
        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        width: 100%;
        padding: 24px 96px 48px 96px;
        box-sizing: border-box;
      }

      section {
        display: flex;
        align-items: center;
      }

      .container {
        border-radius: 44px;
        width: 100%;
        height: calc(100% - 96px);
        max-width: 640px;
        background: var(--custom-drawer-background);
        box-sizing: border-box;
        overflow-y: auto;
        pointer-events: auto;
        display: flex;
        ${elevation2dp}
        box-shadow: 0 1px 18px 0px var(--accent-color);
      }

      custom-input {
        pointer-events: auto;
        padding: 12px;
        box-sizing: border-box;
        max-width: 640px;
        background: var(--custom-drawer-background);
        --custom-input-color: var(--main-color);
        border-radius: 24px;

        ${elevation2dp}
      }

      .pool-item {
      }
      array-repeat {
        display: flex;
        flex-direction: column;
        width: 100%;
      }
        custom-pages {
          height: 100%;
        }
    </style>
      <custom-input placeholder="search by name/address"></custom-input>
      <flex-one></flex-one>


    <span class="container">
    <custom-pages attr-for-selected="data-route">
      <array-repeat data-route="overview">
        <template>
          <style>
            pool-selector-item:nth-of-type(odd) {
              background: #c5c5c5;
            }
            pool-selector-item {
              pointer-events: auto;
              cursor: pointer;
            }
            </style>
          <pool-selector-item address="[[item.address]]" data-route="[[item.address]]"></pool-selector-item>
        </template>
      </array-repeat>

      <nft-pool data-route="pool"></nft-pool>
      </custom-pages>
    </span>
    `
  }
});

var pools = customElements.define('pools-view', class PoolsView extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = this.template;

    this._select = this._select.bind(this);
  }

  connectedCallback() {
    // this._select({detail: api.addresses.pools.GENESIS})
  }

  _select({detail}) {
    this._pool.address = detail;
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }
    </style>

    <pool-selector></pool-selector>
    `
  }
});

export default pools;
