# launch-chain

> launch chain & peernet (reuses exposed transports when already running)

## usage

```js
import launch from '@leofcoin/launch-chain'

const { chain, endpoints, mode } = await launch(
  { mode: 'direct' },
  process.env.LEOFCOIN_PASSWORD
)
// chain is undefined when mode is remote
// endpoints contain urls to connect to the desired remote
// when mode is remote means an instance is already running
// when mode is direct means chain is directly available and no endpoint is needed to interact with it
```

## command line

No monorepo checkout or global install is required:

```sh
npx --package @leofcoin/launch-chain leofcoin --help
```

Run a normal syncing full node with HTTP and WebSocket endpoints:

```sh
npx --package @leofcoin/launch-chain leofcoin node
```

The same CLI exposes `node`, `validator`, `account`, `balance`, `status`, and
`transfer` commands. `node` never registers as a validator. Only the explicit
`validator` command checks validator eligibility and starts participation.

## run a validator

No monorepo checkout is required. Run the validator directly from the published package:

```sh
npx --package @leofcoin/launch-chain leofcoin validator
```

The first run uses the normal interactive identity-password prompt. A new account must receive
the validator contract's minimum balance before it can register. An existing validator must be
online to finalize that registration transaction.

For an unattended server, keep the password outside the repository in a mode-`0600` file:

```sh
npx --package @leofcoin/launch-chain leofcoin-validator \
  --password-file /secure/leofcoin/password \
  --root /var/lib/leofcoin/peach \
  --interval 5
```

The validator also exposes the HTTP API on port `8080` and WebSocket API on port `4040`, so one
process can replace a separate launch-chain server. Change them with `--http-port` and `--ws-port`,
or use `--no-endpoints` for a validator that should not expose an API.

Never put the password or an identity backup in a command-line argument, service file, or Git.
The legacy `leofcoin-validator` command remains an alias for `leofcoin validator`.
Use `leofcoin --help` for all commands and options.

### send LFC from the local validator

When the validator runs in a terminal it exposes a local wallet shell. Private keys never leave
the process:

```text
leofcoin> account
leofcoin> balance
leofcoin> transfer YTq... 1000
```

When the node is stopped, a one-shot transfer can start the same local identity,
finalize the transfer, and exit. It does not register or participate as a validator:

```sh
npx --package @leofcoin/launch-chain leofcoin transfer YTq... 1000 \
  --password-file /secure/leofcoin/password
```

Do not run the daemon and one-shot command simultaneously against the same data root.

## options

### default

```js
{
  network: 'leofcoin:peach',
  stars: ['wss://star.leofcoin.org'],
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
