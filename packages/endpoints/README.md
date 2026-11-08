# Binary RPC migration

Protocol 0.5.0 uses `application/octet-stream` HTTP and binary-only WebSocket
frames. JSON bodies/query parameters and text socket frames are unsupported.
Use the matching `@leofcoin/endpoint-clients@0.4` rather than `response.json()`.
See [wire format, rollout and upstream release gates](../../docs/binary-wire-protocol.md).

# endpoints
 
```js
http(chain, port, networkVersion)
```

```js
wss(chain, port, networkVersion)
```

## Peach-only burst admission

`POST /submitTransaction` accepts a binary `{ chainId, transaction }` map with a
client-signed transaction. It requires Peach, the matching chain ID, synced state
and a connected peer; failures return 403, 409 or 503 respectively.
Admission errors return 422. Success returns `{ status: 'admitted', hash, fee,
chainId }` without waiting for a block. Later execution failures are logged.
This is not finality or a durable manager receipt; use a client-side journal and
verify canonical membership. `/sendTransaction` keeps its existing wait behavior.
Unlike Manager submissions, the burst path does not maintain a bounded manager
receipt collection; it is intended for deliberate high-volume testnet tests.
The matching HTTP client exposes `submitTransaction(transaction, chainId)`.
See the [testnet batch script](../../docs/testnet-batch.md) for safety gates,
encrypted local signing and explicit confirmation.

## Generic contract reads

POST /staticCall accepts a binary map containing `contract`, `method` and an
array `params` (default `[]`). Native BigInts and byte arrays retain their types;
there is no JSON boxing or revival. Use the matching HTTP/WebSocket clients.
Malformed parameters return HTTP 400; rejected read-only queries return HTTP 422.
All reads delegate to the chain's isolated `staticCall` path.

## Public read-only explorer

Deploy/restart the updated endpoints build before enabling anonymous browser
exploration. These binary POST routes never access wallets, select accounts, sign,
submit transactions or fetch missing content from peers. Responses carry
`apiVersion: 1` and `chainId`. Except status, queries must include the expected
`chainId`; a changed chain returns HTTP 409. Non-POST requests return HTTP 405.

| Route | Binary fields | Result |
| --- | --- | --- |
| `/explorer/status` | none | Genesis identity, source tip, connected peer IDs, sync state |
| `/explorer/blocks` | `from`, `count` (1–25), `chainId` | Applied block snapshot, zero-based indexes |
| `/explorer/block` | `hash`, `chainId` | Hash-checked local content as Uint8Array, maximum 1 MiB |
| `/explorer/transaction` | `hash`, `chainId` | Hash-checked local transaction/pool content as Uint8Array |
| `/explorer/pool` | `chainId` | Up to 101 pool hashes; clients display at most 100 |
| `/explorer/overview` | `chainId` | Public counters, registry, top-five holder balances and shares |

Reads time out after 10 seconds. A local content miss returns HTTP 404 rather
than a proxy fetch. Source sync/membership is not a proof of network finality.
No explorer write action is exposed; all application API responses use binary encoding.

## Chain Manager HTTP API

`POST /manager/rpc` accepts `application/octet-stream` (maximum 1 MiB). Requests must
include the full expected `chainId`; the node verifies its own genesis identity
and returns HTTP 409 on a mismatch. All application API responses use binary encoding.
This API never unlocks a node wallet, selects remote accounts or signs messages.
Deploy/restart an updated endpoints package before connecting Chain Manager.

Actions:

| Action | Additional fields | Result |
| --- | --- | --- |
| `status` | optional public `account` | API version, chain identity, sync, peer count, height, contract hashes, account balance in integer units and latest nonce |
| `read` | `contract`, `method`, array `params` | `{ value }`, with native BigInt/byte fields |
| `submit` | signed `transaction`, optional encoded `contract` | transaction hash and explicit status |
| `receipt` | transaction `hash` | durable status, canonical inclusion (`blockHeight`, `blockHash`) and scan progress (`scannedHeight`) when observed, or `unknown` |

Submissions require a synced node with connected peers. A contract upload must
match the signed factory registration, creator and content hash. The node
validates signatures before storing uploaded code. Duplicate transaction hashes
are admitted once, including concurrent duplicates.

`pending` means admitted, not confirmed. The chain's canonical completion
promise or verified canonical block membership produces `confirmed`; execution
rejection produces `failed`. Unverifiable admission
produces `unknown`, never a success-shaped response or an automatic resend.

Before any contract upload/admission, a reservation is durably saved in the
node's existing isolated `chainStore`, under `manager:receipts:v1:<full-chain-id>`.
Storage unavailability/corruption/write failure blocks admission explicitly.
Updates and duplicate checks are serialized. Restarting the HTTP server/node
restores admission history and does not resubmit a reserved transaction.

After restart, `receipt` scans at most 128 canonical blocks per request from the
submission height, persists its cursor and checks recorded inclusion/scan anchors.
It uses canonical worker blocks, not the mempool or raw transaction store; absent
inclusion is `unknown`, never inferred failure. Refresh again to continue a long
scan. A changing tip or unavailable canonical block returns an explicit error
without advancing durable progress. Canonical tip lookup avoids cached fallback
state when the machine exposes its strict getter.

Receipts are bounded to 512 entries per chain. Only completed entries may be
evicted; a full unresolved journal blocks new admission. Reservations written
before a crash can remain unknown if delivery never happened. Evicted entries,
pre-upgrade transactions and receipts from another node are also unknown; these
require operator reconciliation and are not proof of rejection. The journal is
local to a node, not shared across distinct node instances.

Use HTTPS and an operator-controlled endpoint. CORS permits the web and Electron
clients to connect but is not authentication. The API only accepts transactions
already signed by the client; it provides no privileged server-side keys.
Chain-ID checks protect this connection from accidental chain switching; they do
not add cryptographic cross-chain replay protection to the existing wire format.
