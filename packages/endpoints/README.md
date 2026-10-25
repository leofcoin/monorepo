# endpoints
 
```js
http(chain, port, networkVersion)
```

```js
wss(chain, port, networkVersion)
```

## Chain Manager HTTP API

`POST /manager/rpc` accepts `application/json` (maximum 1 MiB). Requests must
include the full expected `chainId`; the node verifies its own genesis identity
and returns HTTP 409 on a mismatch. Existing endpoints remain unchanged.
This API never unlocks a node wallet, selects remote accounts or signs messages.
Deploy/restart an updated endpoints package before connecting Chain Manager.

Actions:

| Action | Additional fields | Result |
| --- | --- | --- |
| `status` | optional public `account` | API version, chain identity, sync, peer count, height, contract hashes, account balance in integer units and latest nonce |
| `read` | `contract`, `method`, JSON array `params` | `{ value }`, using the existing bigint JSON codec |
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