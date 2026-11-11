# @leofcoin/chain

> JS based chain

## Flags

- reachedOneZeroZero

## Cold-sync reliability

Both server and browser nodes guard provider discovery against fast negative
responses. A walk succeeds only after a connected peer confirms it provides
the requested hash; individual discovery requests retain the protocol request
timeout.

Chain content requests probe the exact requested store before requesting bytes
from a peer. A pending-only copy cannot act as a provider for the canonical
transaction store. Responses must use the expected codec and advertised hash;
the first valid response wins, and unavailable content fails explicitly.

Incoming chain data requests only read the requested local store. Missing,
private or concurrently removed content receives an empty data response using
the existing codec and request ID; requesters reject it and can try another
provider. A local miss never starts a recursive peer fetch, and read/send
failures are logged without rejecting the transport's detached handler.

Historical ancestry is resolved iteratively, finishing transaction dependencies
before requesting the next parent. Duplicate callers await the same resolution,
completed blocks survive retries, and missing or cyclic ancestry fails explicitly.
Only dependencies of the selected target tip are resolved; unrelated hashes in
a peer's `knownBlocks` inventory do not gate canonical catch-up.
Transaction bodies are hash-checked before entering the canonical transaction
store. Resolving data never applies it: canonical loading still uses the
serialized state writer and chain-link validation.

## Node routing identities

Every node automatically gets a cryptographically random routing ID, separate
from its wallet identity. Native nodes persist it in `node-routing-id` under
their existing data root (home-relative, like the node's stores). Browser nodes
persist it in browser-local node metadata, scoped by network, data root and
account. Tabs of the same account reuse the same routing ID. The browser app
elects one main tab per network with an exclusive Web Lock: only this tab opens
chain workers, writes chain stores and owns P2P connections. Other unlocked tabs
follow it through bounded binary BroadcastChannel requests. They sign payments
locally and forward only signed transactions; passwords and private keys never
cross the channel. Validator activation and contract deployment stay in the main
tab. Closing the main tab allows an unlocked follower to take over using its
selected account; timeouts never create a competing state writer.
Reloads reuse the account's saved ID. No manual ID is needed.

`peernet.id` and `peernet.client.peerId` identify the transport node;
`peernet.peerId` still identifies the wallet and `peernet.selectedAccount`
remains the account used for signing and validator participation. IDs do not
grant stake or voting power. Wallet keys, backups, addresses, chain IDs and
genesis are unchanged. Ledger-only resets do not remove routing metadata.
When cloning a full native data root to a new installation, exclude
`node-routing-id`; wallet-only imports naturally get a different routing ID.
Invalid saved routing metadata stops startup instead of silently rotating it
or falling back to the shared wallet ID.

## Crash recovery and checkpoints

Invalid-transaction gossip is decoded once at the binary boundary. Malformed
payloads and pool storage failures are logged without an unhandled asynchronous
pubsub rejection; notification handling does not change canonical block validity.

Local proposal failures propagate to the participation caller with their original
cause instead of entering an immediate retry loop. The epoch-running flag is
released on failure, so an explicit activation retry remains possible. Proposal
errors retain their underlying storage or signing message.

State snapshots use two alternating, checksummed `checkpoint:0` / `checkpoint:1`
records. Each record binds the chain ID and canonical tip to the **complete**
contract state, committed account nonces and financial counters. An interrupted
write leaves the previous verified slot available. Storage I/O errors propagate;
if neither existing slot validates, startup refuses readiness rather than
inventing balances or resetting counters. Preserve that root and rebuild into a
separate data root when both checkpoints are unrecoverable.

Startup verifies the ancestry of the checkpoint and persisted recovery target,
restores derived nonces, then replays only the unapplied suffix through the same
signature, validator, economics and serialized execution path as live blocks.
A durable recovery target preserves a multi-block replay across another crash.
If a hash-checked speculative recovery target diverges from an already committed
checkpoint, startup warns and preserves the committed history. The marker is
removed only after recovery succeeds; its block bodies are not deleted.
Conflicting uncheckpointed histories, missing bodies, invalid ancestry and storage
I/O errors still stop recovery explicitly without discarding the target.
The tip is checkpointed before updating the chain marker or announcing success.
Local transaction bytes are not considered evidence of prior execution;
committed sender nonces prevent executing a transfer twice.
Proposal preparation also removes pending entries at or below each sender's
committed nonce, even when their hashes differ from the committed transactions.
An existing recovery block containing such an obsolete nonce still rejects
startup; the error identifies the transaction, nonce, committed nonce and block
height. Preserve that data root for recovery rather than bypassing replay checks.

Older, split `lastBlock` / `states` / `accounts` / `info` snapshots are not trusted
as coherent checkpoints. On first startup they are rebuilt from their hash-checked
block ancestry and validated transactions, without removing ledger or identity
files. Missing historical content or invalid execution stops recovery explicitly.
No new genesis is required for this local storage change.

Peer catch-up verifies that the entire requested suffix extends the local
canonical tip, checks the advertised target height, and stores the suffix bodies
before persisting a recovery target. Discovery and restoration do not overwrite
the committed chain marker with a peer's advertised tip. Resolution alone does not
remove pending transactions; canonical execution does.

Two nodes using the same signing address represent one validator, not two votes.
Run only one participating producer per validator key. Node count or a higher
advertised tip is not proof that a conflicting fork is canonical. This recovery
logic does not roll back committed checkpoints or implement quorum-proven fork
selection. Preserve divergent roots for investigation rather than resetting the
ledger or copying a webnode's state over a validator's state.

Build `@leofcoin/workers` before `@leofcoin/chain` and deploy matching artifacts;
the worker now exposes a serialized full-snapshot operation and no longer owns a
separate startup-replay implementation. Process-isolated LevelDB tests exercise
normal restarts, crashes before/during/after checkpoint writes and marker writes,
plus invalid producer proofs and execution failures. These tests do not establish
live multi-peer consensus correctness or protection against arbitrary disk loss.

## Contract calls and read isolation

Public `call(transaction)` now accepts a **signed transaction object**, not the
old `(contract, method, params)` direct-execution form. `transfer(transaction)`
likewise requires a signed native-token transfer. Both use `sendTransaction()`:
admission returns a pending handle; only canonical execution changes state.
Caller-supplied `hash` metadata is ignored and recomputed from signed content.
`internalCall(sender, ...)` no longer permits public sender impersonation, and
native minting is reserved for the monetary protocol. CLI/wallet helpers that
already sign and submit transactions keep working.

`staticCall(contract, method, params = [])` queries an isolated worker restored
from the last committed snapshot, with `msg.sender = 'leofcoin:read-only'`.
It never uses the node's selected account as read authority. Mutating getters
and methods are rejected when their exported state changes; nested mutating
`msg.call()` is denied. Results are cloned, so returned references cannot alter
canonical state or cached results. Private validator snapshot bookkeeping stays
inside the canonical block writer; name-service lookup uses the read path.

Contract-to-contract `msg.staticCall()` during execution uses a separate read
worker seeded from the transaction's current in-flight state and retains the
calling contract as sender. A rejected nested mutation rejects execution; it
does not mutate the queried canonical contract. Code instrumentation is cached,
but evaluated classes and closures are reconstructed for each uncached query.

Workers are lazy and reused. Public read queues are capped at 32; queries at
64 KiB; results and the result cache at 4 MiB (maximum 64 entries). Instrumented
code caches are bounded to 8 MiB/128 entries. Reads time out after 10 seconds;
execution metering still applies. A committed snapshot invalidates result caches.
Use `machine.close()` to release the canonical and both lazy query workers.
Nested static-call execution rules are stricter than in older runtimes: coordinate
the rollout across all validators before producing blocks; do not mix execution
policies within one active network.
This is state separation, not an OS security sandbox or a full audit of arbitrary
JavaScript host-escape resistance. Consensus quorum certificates and durable
validator vote locks remain separate follow-up work.

## Pending transaction propagation

Transactions enter the local pending pool before canonical confirmation. Peers
relay newly accepted transaction bytes using the existing `add-transaction`
topic; duplicate and already-confirmed entries are not relayed again.

On compatible peer reconnection, pending pools are reconciled even at equal
block heights. Missing bodies are fetched from `transactionPool`, checked against
their advertised hash, and admitted through the normal signature-validation and
pending-nonce path. Unavailable or invalid entries are logged without preventing
recovery of the remaining entries.

Pool admission and pubsub publication are not validator acknowledgements.
`sendTransaction().wait` resolves only after canonical block inclusion. Deploy
the updated chain runtime to intermediate nodes and validators as well as the
browser to enable relay and reconnect recovery throughout the network.

## Application-scoped discovery

Peernet's discovery API is `network` plus `protocolVersion`. Internally the chain
uses its fixed application UUID (`CHAIN_APP_ID`) and the selected network name,
plus its genesis-derived `chainId`. Star needs no app/network configuration.

The chain wrapper retains the existing ledger name (for example
`leofcoin:peach`), signature domain, wallet provider, account derivation and data
root. It translates these to the app-scoped Peernet network without regenerating
genesis. Generic SDK options `protocol`, `networkVersion`, `version` and
`discoveryNetwork` are no longer accepted by Peernet; existing chain/launcher
configuration is adapted at the chain boundary, not forwarded as SDK aliases.

Upgrade Swarm/Star, then Peernet, then the chain/launcher dependency minimums and
rebuild. Nodes reject old SDKs before opening wallet/data stores. No published
version numbers are implied by these source changes.

<a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/"><img alt="Creative Commons Licence" style="border-width:0" src="https://i.creativecommons.org/l/by-nc/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/">Creative Commons Attribution-NonCommercial 4.0 International License</a>.
