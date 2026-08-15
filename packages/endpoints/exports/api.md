#### [selectAccount(address: `string`)](https://remote.leofcoin.org/select-account?address=)

`address`: desired address

> set default account to given address

```js
await client.selectAccount(address)
```

<br>

#### [getBlock(index: `number`)](https://remote.leofcoin.org/getblock?index=0)

`index`: index of the block to fetch<br>

```js
await client.getBlock(10)
```

<br>

#### [blocks(amount)](https://remote.leofcoin.org/blocks)

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

#### [lookup(name: `string`)](https://remote.leofcoin.org/lookup?name=ArtOnlineContractFactory)

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

#### [accounts()](https://remote.leofcoin.org/accounts)

```js
await client.accounts()
```

<br>

#### [hasTransactionToHandle()](https://remote.leofcoin.org/hasTransactionToHandle)

```js
await client.hasTransactionToHandle()
```

<br>

#### [balances()](https://remote.leofcoin.org/balances)

> returns all balances

```js
await client.balances()
```

<br>

#### [balancOf(address: `string`, format: `boolean`)](https://remote.leofcoin.org/balanceOf?address=YTqxKshWH4Qo7KprGYxQVCNYutedaE6YGoUdUPnUdFUVBPrTzgsrP&format=true)

`address`: The address to check<br>
`format`: Wether or not to format<br>

> returns the balance of given address as BigNumber or string (when format is true)

```js
await client.balanceOf(address, true)
```

<br>

#### [getNonce(address: `string`)](https://remote.leofcoin.org/getNonce?address=YTqxKshWH4Qo7KprGYxQVCNYutedaE6YGoUdUPnUdFUVBPrTzgsrP)

`address`: The address to check<br>
`format`: Wether or not to format<br>

> returns the balance of given address as BigNumber or string (when format is true)

```js
await client.getNonce(address)
```

<br>

#### [selectedAccount()](https://remote.leofcoin.org/selectedAccount)

```js
await client.selectedAccount()
```

<br>

#### [peerId()](https://remote.leofcoin.org/peerId)

```js
await client.peerId()
```

<br>

#### [peers()](https://remote.leofcoin.org/peers)

```js
await client.peers()
```

<br>

#### [validators()](https://remote.leofcoin.org/validators)

```js
await client.validators()
```

<br>

#### [contracts()](https://remote.leofcoin.org/contracts)

```js
await client.contracts()
```

<br>

#### [totalContracts()](https://remote.leofcoin.org/totalContracts)

```js
await client.totalContracts()
```

<br>

#### [nativeToken()](https://remote.leofcoin.org/nativeToken)

```js
await client.nativeToken()
```

<br>

#### [nativeCalls()](https://remote.leofcoin.org/nativeCalls)

```js
await client.nativeCalls()
```

<br>

#### [nativeMints()](https://remote.leofcoin.org/nativeMints)

```js
await client.nativeMints()
```

<br>

#### [nativeBurns()](https://remote.leofcoin.org/nativeBurns)

```js
await client.nativeBurns()
```

<br>

#### [nativeTransfers()](https://remote.leofcoin.org/nativeTransfers)

```js
await client.nativeTransfers()
```

<br>

#### [totalBurnAmount()](https://remote.leofcoin.org/totalBurnAmount)

```js
await client.totalBurnAmount()
```

<br>

#### [totalMintAmount()](https://remote.leofcoin.org/totalMintAmount)

```js
await client.totalMintAmount()
```

<br>

#### [totalTransferAmount()](https://remote.leofcoin.org/totalTransferAmount)

```js
await client.totalTransferAmount()
```

<br>

#### [totalTransactions()](https://remote.leofcoin.org/totalTransactions)

```js
await client.totalTransactions()
```

<br>

#### [totalSize()](https://remote.leofcoin.org/totalSize)

```js
await client.totalSize()
```

<br>

#### [poolTransactions()](https://remote.leofcoin.org/poolTransactions)

```js
await client.poolTransactions()
```

<br>

#### [transactionsInPool()](https://remote.leofcoin.org/transactionsInPool)

```js
await client.transactionsInPool()
```

<br>

#### [transactionPoolSize()](https://remote.leofcoin.org/transactionPoolSize)

```js
await client.transactionPoolSize()
```

<br>

#### [totalBlocks()](https://remote.leofcoin.org/totalBlocks)

```js
await client.totalBlocks()
```

<br>

#### [lastBlockHeight()](https://remote.leofcoin.org/lastBlockHeight)

```js
await client.lastBlockHeight()
```

<br>

#### [participating()](https://remote.leofcoin.org/participating)

```js
await client.participating()
```

<br>

#### [network()](https://remote.leofcoin.org/network)

```js
await client.network()
```

<br>

#### [networkStats()](https://remote.leofcoin.org/networkStats)

```js
await client.networkStats()
```

<br>

#### [networkStats()](https://remote.leofcoin.org/networkStats)

```js
await client.networkStats()
```

<br>

#### [lastBlock()](https://remote.leofcoin.org/lastBlock)

```js
await client.lastBlock()
```

<br>

#### [blockHashMap()](https://remote.leofcoin.org/blockHashMap)

```js
await client.blockHashMap()
```

<br>

#### [bootstrap()](https://remote.leofcoin.org/bootstrap)

```js
await client.bootstrap()
```

<br>
