# addresses
> Arteon contract addresses

## install
```sh
npm i --save @arteon/addresses
```

## usage

```js
import arteonAddresses from '@arteon/addresses';

(async () => {
  const addresses = await arteonAddresses('mainnet')
  console.log(addresses.token)
  console.log(addresses.pools)
  console.log(addresses.cards)
})()
```
