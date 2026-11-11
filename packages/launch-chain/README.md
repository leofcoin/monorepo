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

Requires Node.js 24.15.0 or newer. The default native WebRTC backend is
`@vandeurenglenn/wrtc` 0.7.2 or newer.

### automatic peer transports

Launch-chain 0.4.25 requires chain 1.10.17 and lib 1.3.15, using published
peernet 3 / swarm 0.10. Peers discover an available WebTransport relay through
their configured star; clients do not need a relay URL, shared secret or TLS
configuration. WebRTC and circuit fallback remain available when no relay is
advertised. HTTP/3 needs reachable UDP and a correctly configured public star.
Node's HTTP/3 backend also needs the optional native QUIC package's installation
hook. This repository approves its exact reviewed version in `allowScripts`.
Standalone installations using npm's script-blocking policy must review/approve
that native package as well; the launcher never bypasses that policy.

The star operator must also deploy swarm 0.10. Its `npm start` starts the star
and relay together, creates the private relay secret, and discovers an existing
matching Let's Encrypt certificate. Multiple certificate names require a one-time
hostname selection. This does not issue certificates or change DNS/firewalls.
See the [relay operator guide](https://github.com/netpeer/swarm/blob/main/docs/webtransport-relay.md).

This dependency update does not change the Peach genesis, protocol version,
account identities, passwords or data directory. Do not delete existing stores.
Stop the existing process before upgrading and restart using the same data root.
If startup fails, the CLI reports the error and exits with status 1 even when
partially started workers or transports still hold the process open.

For development, after building, `npm run test:package -w @leofcoin/launch-chain`
checks a clean tarball install, npm CLI entry and real-genesis offline startup
using temporary storage. It is not proof of public peer sync or validator finality.

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
leofcoin> batch
```

### interactive testnet batch

Type `batch` in the existing node or validator wallet shell. It uses the already
unlocked wallet and selected account in that process: **no wallet export, password
file, extra endpoint, or second node is required**.
When the node is stopped, `leofcoin batch [options]` opens the existing local
wallet in a normal non-participating node and starts the same wizard. It requires
a terminal. Do not run it alongside a node using the same root.

The wizard asks for transaction count (default 100,000), recipient (default self),
LFC per transaction (default one atom), and concurrency (default 32). Smaller and
larger positive safe-integer counts are supported. Enter `yes` to prepare; after
signing and exact fee/balance checks, enter `SEND` to actually enqueue.
Anything else at either confirmation cancels without sending.

Only a synced, connected Peach node is accepted. Local validator heartbeats are
paused while the wizard owns the wallet. A transfer already awaiting finalization
must finish first. Do not use this account from another node, wallet UI or API
during the batch; the wizard rechecks its nonce before sending but cannot reserve
the key across other processes.

All transactions are signed before submission; concurrency bounds simultaneous
admission calls, not total pool size. Submissions do not wait for blocks, and
`admitted` is not finality. Self-transfers recycle principal but still need the
transfer amount plus all fees. Preparing very large batches uses time and memory.
Only load testnets you own or have permission to test.

Receipts are automatically saved under `~/.leofcoin/batch-receipts/` in a unique
mode-0600 JSONL file. Each attempted transaction records its signed public fields
before submission, then hash/status after admission. No private keys or passwords
are stored. Errors stop new calls and drain in-flight work; unknown transactions
may still finalize. Reconcile the journal and pending/canonical state before
retrying; no automatic retry or cancellation of admitted transactions occurs.

The standalone [batch script](../../docs/testnet-batch.md) remains available for
automation with explicit encrypted signer files.

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
external: ['@vandeurenglenn/wrtc', '@koush/wrtc', '@leofcoin/endpoints/ws', '@leofcoin/endpoints/http']
```

### webpack

```js
externals: {
  '@vandeurenglenn/wrtc': false,
  '@koush/wrtc': false,
  '@leofcoin/endpoints/ws': false,
  '@leofcoin/endpoints/http': false
}
```
