# endpoint-clients
 
## install
```sh
npm i @leofcoin/endpoint-clients
```

## usage
```js
import WsClient from '@leofcoin/endpoint-clients/ws'
import HttpClient from '@leofcoin/endpoint-clients/http'

const networkVersion = 'peach'

const ws = new WsClient('ws://localhost:4040', networkVersion)
const http = new HttpClient('http://localhost:8080', networkVersion)
```

## api
### new Client(url, networkVersion)
#### selectAccount(address: `string`)
`address`: desired address
> set default account to given address
```js
await client.selectAccount(address)
```
<br>

#### getBlock(index: `number`)
`index`: index of the block to fetch<br>
```js
await client.getBlock(10)
```
<br>

#### blocks(amount)
`amount`: the amount to slice
```js
await client.blocks(-25)
```
<br>

#### createTransactionFrom(from: `string`, to: `string`, method: `string`, parameters: `array`, nonce: `number` | `undefined`)

`from`:<br>
`to`: <br>
`method`: <br>
`parameters`: <br>
`nonce`: <br>
```js
await client.createTransactionFrom(from, to, method, parameters, nonce)
```
<br>

#### lookup(name: `string`)
`name`: name of the contract to lookup the address and owner of
```js
await client.lookup('contractName')
```
<br>

#### participate(address: `string`)
`address`: <br>

```js
await client.participate(address)
```
<br>

#### staticCall(contract: `string`, method: `string`, params: `array`)
`contract`: contract address todo the call on
`method`: method/function to call
`params`: array containing params needed to call the desired method 
```js
await client.staticCall(contract, method, params)
```
<br>

#### createContractAddress(owner: `string`, code: `string`, params: `array`)
`owner`: address of the deployer<br>
`code`: contract as a string<br>
`params`: contract constructor params<br>

```js
const address = await client.createContractAddress(owner, code, params)
```
<br>

#### deployContract(code: `string`, params: `array`)
`code`: contract as a string<br>
`params`: contract constructor params<br>

```js
const tx = await client.deployContract(code, params)
```
<br>

#### accounts() 
```js
await client.accounts()
```
<br>

#### hasTransactionToHandle() 
```js
await client.hasTransactionToHandle()
```
<br>

#### balances()
> returns all balances
```js
await client.balances()
```
<br>

#### balancOf(address: `string`, format: `boolean`)
`address`: The address to check<br> 
`format`: Wether or not to format<br>
> returns the balance of given address as BigNumber or string (when format is true)
```js
await client.balanceOf(address, true)
```
<br>

#### selectedAccount()
```js
await client.selectedAccount()
```
<br>

#### peerId()
```js
await client.peerId()
```
<br>

#### peers() 
```js
await client.peers()
```
<br>

#### validators() 
```js
await client.validators()
```
<br>

#### nativeBurns()
```js
await client.nativeBurns()
```
<br>

#### contracts()
```js
await client.contracts()
```
<br>

#### nativeMints()
```js
await client.nativeMints()
```
<br>

#### nativeToken()
```js
await client.nativeToken()
```
<br>

#### nativeTransfers()
```js
await client.  nativeTransfers()
```
<br>

#### totalSize()
```js
await client.totalSize()
```
<br>

#### totalTransactions()
```js
await client.totalTransactions()
```
<br>

#### totalBlocks()
```js
await client.totalBlocks()
```
<br>

#### nativeCalls()
```js
await client.nativeCalls()
```
<br>

#### participating()
```js
await client.participating()
```
<br>
