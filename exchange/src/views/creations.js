import './../animations/loading'
import './../elements/creations-token-item'
import { abi as CREATEABLES } from './../../../build/contracts/Createables.json'
import { abi as LISTING_ERC1155_ABI } from './../../../build/contracts/IArtOnlineListingERC1155.json'

export default customElements.define('creations-view', class CreationsView extends BaseClass {
  constructor() {
    super()
  }

  connectedCallback() {
    this._init()
  }

  async _init() {
    await isApiReady()
    if (!api.connection) {
      await api.connectWallet()
    }
    console.log(api);
    const contract = new ethers.Contract(api.addresses.createables, CREATEABLES, api.connection.provider)
    const owners = {}
    const items = []
    let _tokens = 0

    const parse = async token => {
      let exists = await contract.exists(token)
      if (exists) {
        const balance = await contract.callStatic.balanceOf(api.connection.accounts[0], token)
        const supply = await contract.callStatic.totalSupply(token)
        const tokens = []
        const ids = []
        for (let i = 1; i <= supply; i++) {
          ids.push(i)
          tokens.push(token)
          const owner = await contract.callStatic.ownerOfBatch(tokens, ids)
          owners[token] = await contract.callStatic.ownerOfBatch(tokens, ids)
          owners[token] = owners[token].map(owner => {
            return {
              owner,
              i,
              token
            }
          })
        }
        console.log(owners[token]);
        // items.push({name, symbol, icon: icon['color'] || icon, address, balance: ethers.utils.formatUnits(balance)})
        _tokens += 1
        return parse(token + 1)
      }
    }

    await parse(1)


    for (let i = 1; i <= _tokens; i++) {
      console.log(i, owners[i].length);

      for (let _i = 0; _i < owners[i].length; _i++) {
        console.log(_i);
        const item = owners[i][_i]
        console.log(item);
        console.log(api.addresses.exchangeFactory);

        if (item.owner === api.connection.accounts[0]) {
          const response = await fetch(`https://api.artonline.site/nft/json?address=${api.addresses.createables}&id=${i}&token=${item.token}`)
          const json = await response.json()
          items.push({name: json.name, symbol: json.symbol ? json.symbol : json.name, onexchange: item.owner === api.addresses.exchangeFactory, token: item.token, tokenId: item.i, image: json.image})
        } else {
          const address = await api.contract.getListingERC1155(api.addresses.createables, item.token, item.i);
          const contract = new ethers.Contract(address, LISTING_ERC1155_ABI, api.connection.provider)
          if (item.owner === address) {
            const response = await fetch(`https://api.artonline.site/nft/json?address=${api.addresses.createables}&id=${i}&token=${item.token}`)
            const json = await response.json()
            console.log(json);
            items.push({name: json.name, symbol: json.symbol ? json.symbol : json.name, onexchange: item.owner === api.addresses.exchangeFactory, token: item.token, tokenId: item.i, image: json.image})
          }
        }
      }
    }


console.log(owners);
console.log(items);
    this.sqs('array-repeat').items = items
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

      array-repeat {
        max-width: 640px;
        width: 100%;
        box-shadow: 1px 1px 13px 5px var(--accent-color);
      }

      [slot="content"] {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }
    </style>
    <array-repeat>
      <template>
        <creations-token-item name="[[item.name]]" symbol="[[item.symbol]]" token="[[item.token]]" tokenid="[[item.tokenId]]" onexchange="[[item.onexchange]]" image="[[item.image]]"></creations-token-item>
      </template>
    </array-repeat>
    `
  }
})
