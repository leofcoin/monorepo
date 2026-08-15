# lauch-chain

> launch chain & peernet (reuses exposed transports when already running)

## usage

```js
import launch from '@leofcoin/launch-chain'

const { chain, endpoints, mode } = await launch()
// chain is undefined when mode is remote
// endpoints contain urls to connect to the desired remote
// when mode is remote means an instance is already running
// when mode is direct means chain is directly available and no endpoint is needed to interact with it
```

## options

### default

```js
{
  network: 'leofcoin:peach',
  stars: ['wss://peach.leofcoin.org'],
  forceRemote: false, // when set to true only tries to connect to an external/local exposed node
  ws: {
    port: 4040,
    url: 'ws://localhost:4040'
  },
  http: {
    port: 8080,
    url: 'http://localhost:8080'
  }
}
```

### disabling options

```js
stars: [] // note that disabling stars results in no peer discovery
{
  ws: false,
  http: false
}
```

## build for browser

no prebuild are provided since the esm switch, everything is written with the browser in mind so some simple ignores are enough to build.

### rollup

```js
external: ['@koush/wrtc', '@leofcoin/endpoints/ws', '@leofcoin/endpoints/http']
```

### webpack

```js
externals: {
  '@koush/wrtc': false,
  '@leofcoin/endpoints/ws': false,
  '@leofcoin/endpoints/http': false
}
```
