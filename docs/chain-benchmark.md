# Full-runtime chain benchmark

This benchmark compares the published `@leofcoin/chain@1.10.22` tarball with
the current workspace. It is **not** a codec-only comparison: the workspace also
contains consensus-state and recovery changes. Production code is never patched
by the benchmark.

## Run

Build the current runtime once if its inputs changed (`npm run build:core`).
Do not rebuild while benchmark nodes are running.

```sh
npm run benchmark:chain:prepare
npm run benchmark:chain -- --baseline node_modules/.cache/chain-baseline-1.10.22 --transactions 32 --samples 3
npm run test:chain-benchmark
```

For a current-runtime correctness check (no npm baseline installation needed):

```sh
npm run test:e2e:chain-runtime
# Or three larger, independent runs:
npm run benchmark:chain -- --current-only --transactions 32 --samples 3
# Long isolated run with normal consensus limits/cadence:
npm run benchmark:chain -- --current-only --transactions 100000 --batch-size 128 --samples 1 --timeout-ms 3600000 --output node_modules/.cache/chain-100000.json
```

CI runs the current-runtime check after the existing multi-process tests. Current-only
reports can pass, but always set `comparable: false`: no second release was measured.
Up to 100,000 transfers are supported with an explicit `--batch-size` (at most
512; use 128 for the current protocol's transaction count and byte limits).
Batches are submitted after the preceding batch is committed on both live nodes.
This bounds the pending pool and signing/IPC payloads; it is not a 100,000-entry
mempool saturation test. A long run retains the actual block cadence and may take
over an hour. `--timeout-ms` bounds individual operations and wait phases,
not the entire run. Progress is emitted after each committed batch.
The `test:e2e:chain-runtime` script also injects failing synchronous and asynchronous
observers on every node (`--faulty-observers`). This is a correctness test, not a
performance run. Omit that flag for an ordinary batch-timing measurement.

Preparation uses the committed npm lockfile and `npm ci --ignore-scripts` in a
private cache directory, including platform-specific optional prebuilt packages.
No global install, lifecycle-script approval, public network, wallet, or live
chain database is needed. An unchanged prepared baseline is reused. An existing
matching isolated install can also be passed directly with `--baseline`.

Reports default to `node_modules/.cache/chain-benchmark-result.json`; select a
different file with `--output`. A correctness failure exits with status 2 and
suppresses subsequent repetitions of that variant. The report keeps raw timings
for diagnosis, explicitly marked `validForComparison: false`. Only completely
passing samples contribute to the median summary.

## Workload and correctness gates

Each variant gets its own loopback signaling server and private temporary stores.
It uses that variant's unmodified node, bundled contracts, messages, and real
one-validator proposal/vote/block-execution path. Setup installs a trusted test
anchor at height 13 for protocol 0.6 (height 0 for earlier protocols) and stakes
a generated test account. The 0.6 fixture stores its complete, signed empty 0.5
ancestry and starts measured production at the block-14 activation. This is a synthetic
checkpoint fixture, **not a new production genesis or a genesis-validation test**.

Signed transfers enter through a second node and propagate to the producer.
Timing includes admission, signature verification, networking, consensus,
execution, producer checkpoint persistence, and live-follower confirmation.
Signing is now included and separately reported as `signingMs`; fixture setup is
excluded. Earlier reports excluded signing and are not directly comparable.
The old anchor timestamp makes the first block immediately eligible;
`transactions / elapsed time` is therefore **batch throughput, not sustained TPS**.
No production timing or economics rules are changed.
Multi-block reports also include `confirmation.interCommit`: transactions after
the first measured commit divided by the time between the first and last commit.
This excludes the immediately eligible first block, but remains an observed rate
for this workload, not a network-wide capacity guarantee.

`operationTimings` records calls, cumulative elapsed time and maximum latency
for signature validation, contract reads, machine execution/checkpoint operations
and transaction/account store access on the producer and live follower.
These are overlapping wall-clock timings, including queue waits, not exclusive
CPU samples: do not add them together or compare their sum to total runtime.

After commitment, both nodes must agree on the tip and independently pass:

- Exact transaction membership, committed sender nonce, and recipient balance.
- Exact native transfer count; execution count also includes one validator snapshot.
- Sum of token balances equals total supply, including protocol minting/burning.

A third, cold node must then fetch and execute all measured blocks from the same
anchor, pass the same checks, and retain correct state after a process restart.
Audits check transaction membership over the complete history, with exactly one
validator snapshot execution per measured block. A multi-batch report records
the actual block count; no runtime consensus limits are changed.

CPU is sampled for the signaling server, runtime processes and child workers.
It is CPU time, not instantaneous utilization or electricity consumption.
Aggregate RSS can count shared pages multiple times; short-lived worker tails
and sub-sample memory peaks can be missed. Host load is recorded. All paths are
guarded to prevent storage from escaping the private temporary root.

## Initial findings (2026-11-02)

The eight-transfer probe does **not** yield a valid speedup comparison:

- Published 1.10.22: its canonical block contains all eight hashes and advances
  the sender nonce to 8, but the recipient receives **0 rather than 800 atoms**;
  the native transfer counter stays zero. The existing transaction-body presence
  check skips execution. Header-only throughput would be misleading.
- Current workspace (`887403fb`): the producer correctly credits **800 atoms**,
  commits nonce 8 and counts eight native transfers. The live ingress/follower
  then fails during `block-processed` notification: installed `little-pubsub`
  iterates a mutable subscriber array while transaction waiters unsubscribe,
  throwing `Cannot read properties of undefined (reading 'bound')`. That
  exception reaches the canonical-state queue, which correctly refuses further
  application after a failed operation.

Cold-sync/restart measurements are intentionally not presented when the earlier
live-state gate fails. A faster encoder alone does not establish higher chain
TPS or lower power use.

## Notification fix and verification (2026-11-02)

Transaction waiters now unsubscribe in a Promise finalizer, after synchronous
event dispatch has finished. Multiple waiters cannot mutate the active handler
array, and a settled canonical success ignores later stale failure events.
Pool-deletion errors also reject and clean up the waiter instead of leaking a
pending Promise. This changes neither consensus validation nor block economics;
the upstream dependency and the published baseline remain untouched.

Verification after rebuilding the chain:

- 158 chain tests pass, including real-bus regression coverage with 128 simultaneous
  transaction waiters, cached notifications, and pool-deletion failure handling.
- Three independent runs of 32 transfers pass on producer, live follower, cold
  observer, and restarted observer. Every audited node has nonce 32, recipient
  balance 3,200 atoms, identical block hashes, and conserved supply.
- On the local Apple M4 Pro / Node 26.2.0 probe, median batch confirmation was
  approximately 540 ms; one-block cold sync was approximately 316 ms. These are
  local batch timings, not sustained/network-wide TPS or a baseline speedup.

The original npm baseline still fails the execution gate, as expected. Do not
silently patch that baseline to manufacture a passing speed comparison. Existing
corrupted state from that release is not repaired by this notification fix; use
the separately tested checkpoint recovery path or a clean isolated test root.

## Observer isolation and submission cleanup (2026-11-05)

Transaction-success notifications now follow the durable block checkpoint, never
speculative execution. Chain observations (including last-block and sync progress)
use a snapshot of the public LittlePubSub listener registry, isolate synchronous
throws and asynchronous rejections per listener, and copy notification data so
observers cannot mutate canonical headers or byte buffers. Later listeners still
receive the event. Consensus votes and worker/RPC replies do not use this path;
real execution and persistence failures still halt the canonical writer safely.

Admission calculates fees before allocating a waiter. A local admission failure
cancels its waiter and removes pending-nonce bookkeeping even if pool cleanup also
fails, while preserving the original error. Cancelling this local wait does not
cancel an already committed transaction or delete another caller's shared data.
A temporary propagation failure still leaves the durable pool entry available for
retry and returns a usable confirmation waiter.

Regression coverage includes faulty observers before normal listeners, cached
notifications, self-unsubscription, failed checkpoint writes without success
events, and failed admission/cleanup without leaked listeners.

## Exact-signature reuse (2026-11-13)

Profiling three independent 512-transfer runs (two 256-transfer batches each)
found about five signature-validation calls per transfer on the producer.
Canonical execution and checkpoint writes were much smaller than the repeated
cryptographic work. Positive signature checks now share a bounded 4,096-entry
in-memory cache, including in-flight duplicate checks. Cache keys cover a fresh
snapshot of the complete encoded transaction, including its signature, and the
network. Changed payloads/signatures are checked independently; failed checks are
removed and can retry. Nonce, fee, block-economics and canonical-state checks are
not cached or skipped.

On the local Apple M4 Pro / Node 26.2.0, using the same workload and instrumentation:

| Median over three runs | Before | After |
| --- | ---: | ---: |
| 512-transfer confirmation, including signing | 16,824 ms | 7,793 ms |
| Batch transfers/second | 30.43 | 65.70 |
| Sampled confirmation CPU, all benchmark descendants | 18,590 ms | 8,720 ms |
| Peak aggregate confirmation RSS, shared pages included | 803 MiB | 874 MiB |
| Cold sync of both measured blocks | 2,595 ms | 1,598 ms |
| Producer signature-validation cumulative elapsed time | 6,481 ms | 1,344 ms |

All six samples passed producer, follower, cold-sync and restart state audits.
These results include the first immediately eligible block and are **not sustained
TPS**. The unchanged limits of 256 transactions per block and a 6-second target
interval still bound steady-state proposal capacity to about 42.7 transfers/s.
Neither these results nor a larger block-size constant establish 10,000 tx/s.
Byte limits, propagation, multi-validator quorum, large pools, execution and
durable restart must be measured before a coordinated protocol-limit change.

An additional 2,048-transfer run committed eight 256-transfer blocks and passed
all four state audits. Excluding the first immediately eligible commit, the
remaining 1,792 transfers committed over 42.044 seconds: **42.62 tx/s**, close
to the unchanged cadence/count ceiling. Thus further sustained-throughput gains
require a separately evaluated, coordinated protocol change, not just this cache.
The four-validator runtime gate also passed minority-quorum rejection, partition
healing, a precommit crash/restart and cold recovery with the activation anchor.

## Separate block and transaction delivery

Blocks retain transaction hash references; transaction bodies are stored and
transferred separately. Block content requests return only the canonical block
bytes, without transaction bundles or additional capability probes. The
exact-signature cache above remains enabled. No ledger migration or protocol
change is required for this transport decision.

## Pending-pool indexing and execution batches

Proposal selection now maintains sender/nonce metadata instead of decoding,
hashing and sorting the complete pool for every block. Startup rebuilds this
index once from the durable pool. Nonce gaps, competing transactions and
concurrent admission/commit still require the existing canonical checks; index
membership is not proof of execution or commitment.

Ordinary blocks send ordered fee/contract execution to the worker in one batch.
Execution remains serial, stops at the first failure and rejects uncommitted
transaction waiters without reporting a successful block. Contract-registration
blocks and oversized historical blocks retain the per-transaction path.
Transaction bodies, final sender nonces and pool deletions use queued storage
batches. ClassicLevel writes are atomic within each store batch; browser OPFS
batches hold the queue but are not crash-atomic across files. The existing
canonical checkpoint/recovery boundary remains essential.

Build and deploy matching storage, worker and chain packages together. This
changes internal worker calls, not the canonical block schema or peer protocol.
Blocks and transaction bodies remain separate. No live ledger was reset,
migrated or redeployed for these measurements.

### Measurements

Apple M4 Pro, Node 26.2.0; medians of three independent samples per variant.
Both full-runtime variants already include the exact-signature cache above.

| Full runtime, 512 transfers in two 256-transfer batches | Before | After |
| --- | ---: | ---: |
| Confirmation including signing | 7,581 ms | 7,547 ms |
| Batch transfers/second, not sustained TPS | 67.54 | 67.84 |
| Sampled confirmation CPU, all descendants | 7,530 ms | 7,390 ms |
| Peak aggregate confirmation RSS | 892 MiB | 904 MiB |
| Cold sync | 1,444 ms | 1,343 ms |
| Sampled cold-sync CPU | 2,810 ms | 2,640 ms |
| Peak aggregate cold-sync RSS | 1,315 MiB | 1,336 MiB |
| Producer fee/transfer worker requests | 1,024 | 2 |

All samples passed producer, live-follower, cold-sync and restart state audits.
Two validator-snapshot worker calls remain in both variants. Canonical body and
nonce persistence now use two batches per store instead of individual writes;
the 512 proposal-body writes remain. Confirmation improves only about 0.4%,
which is easily measurement noise, while cold sync was about 7% shorter in these
runs. Memory is slightly higher, not lower.

The separate pool-selection probe executes the actual old and new selection
methods against real encoded transactions, selecting the same 256 hashes:

| Pending entries, one sender | Full scan/sort | Indexed selection | One-time index rebuild |
| --- | ---: | ---: | ---: |
| 10,000 | 564.92 ms | 10.34 ms | 640.25 ms |
| 100,000 | 9,057.31 ms | 10.21 ms | 7,689.71 ms |

Every indexed sample reads exactly 256 bodies and performs no full-pool scan.
This is approximately 55x/887x faster **selection only**, in memory. It excludes
disk I/O, signature verification, VM execution and consensus; it neither proves
multi-sender throughput nor demonstrates 10k/100k TPS. Index metadata consumes
memory and rebuilding it shifts work to startup. The unchanged 256-transaction
limit and 6-second cadence still cap sustained count-based capacity at about
42.7 TPS, before other constraints.

### Reproduction

Capture the full-runtime baseline before applying the optimization, then repeat
the identical command after rebuilding matching runtime packages:

```sh
npm run benchmark:chain -- --current-only --transactions 512 --batch-size 256 --samples 3 --output node_modules/.cache/pool-batches-before.json
# After rebuilding the optimized runtime:
npm run benchmark:chain -- --current-only --transactions 512 --batch-size 256 --samples 3 --output node_modules/.cache/pool-batches-after.json
node --expose-gc scripts/benchmark-pool-selection.js 4ab9a4fb82ddedad9ce3a513d240193ef72010ca
```

The pool probe extracts the baseline selection from the specified commit and the
optimized selection from the worktree; it does not switch branches or modify
runtime source. Its report is
`node_modules/.cache/pool-selection-comparison.json`. The full-runtime before/after
reports are independently audited current-only runs, not an automatically paired
release comparison. Do not mix them with the older published baseline above.

Finalization rebuilt storage, workers and chain together and passed 32 focused
worker/canonical-state regressions, including binary failure-hash propagation
and waiter rejection while failure gossip remains pending. Storage typechecking
passes. Chain diagnostic comparison against HEAD reports no added errors
(388 baseline diagnostics versus 363 current); its standalone typecheck still
has unrelated existing errors.

The timing samples above predate subsequent storage read-concurrency edits and
the final failure-notification correction. They measure the indexing/batching
optimization, not every later worktree change; they were not rerun at finalization.

## One-second payment-latency experiment

The chain accepts `benchmarkBlockTimeMs: 1000 | 6000` **only** when both its
configured and actual ledger networks are `leofcoin:e2e`. An override on Peach
throws; absent an override the existing 6-second cadence remains unchanged.
This is an isolated experiment, not protocol activation. Production genesis,
protocol version, block limits, rewards, epochs and the 10-second consensus
round timeout have not been changed. Original full-runtime benchmarks explicitly
clear the new timing environment variable so an ambient setting cannot distort
their release comparisons.

```sh
npm run build -w @leofcoin/chain
node scripts/benchmark-payment-latency.js --samples 20
```

Each profile starts four independently signed validators on private temporary
stores and loopback WebRTC discovery. Quorum remains three. After one unmeasured
warm-up payment, 20 single-payment arrivals are spread deterministically across
the proposal interval. The parent monotonic clock measures signing, admission,
and receipt of each validator's post-checkpoint block notification. Confirmation
requires all four validators, not just a proposer acknowledgement. The script
checks actual block timestamps against the requested interval and independently
audits history, exact transaction membership, balances, nonce, execution counts
and conserved supply on every validator. Temporary nodes/stores are cleaned up.
Admission uses fixture IPC and the real chain API, not HTTP; its timing is not
a measurement of a remote wallet's HTTP/UI response latency.

Local measurements on the Apple M4 Pro / Node 26.2.0:

| Metric, 20 measured payments per profile | 6-second profile | 1-second profile |
| --- | ---: | ---: |
| Median actual block interval | 6,001 ms | 1,001 ms |
| Admission p95, including signing | 13.0 ms | 13.0 ms |
| All-validator durable confirmation p50 | 3,104 ms | 525 ms |
| All-validator durable confirmation p95 | 5,725 ms | 913 ms |
| All-validator durable confirmation maximum | 5,946 ms | 948 ms |

Both profiles passed all four state audits. The 1-second profile met the
experimental p95 <= 2,000 ms target. The JSON report, including individual
validator percentiles and raw payment timings, is
`node_modules/.cache/payment-latency.json`. Percentiles use nearest rank; with
20 samples p99 is simply the maximum.

These are exploratory low-load local results, **not** geographic-network or
failure-recovery latency guarantees, sustained TPS, or proof of a production-safe
timing change. Round retries can still take much longer than two seconds.
Shortening the interval without adapting per-block rewards would accelerate
issuance per wall-clock second; block-based epochs also pass faster. A production
upgrade still needs coordinated activation, economic/timing rules and
measurements across realistic validator links.
The chain build and 12 focused cadence/round-timeout checks passed. Diagnostic
comparison found no new chain type errors; unrelated baseline errors remain.

### Immediate payment status without premature success

The existing HTTP client already has
`submitTransaction(signedTransaction, expectedChainId)`. Its Peach admission-only
endpoint returns `{ status: 'admitted', hash, fee, chainId }` without awaiting
canonical confirmation. A wallet can map this to **"betaling ontvangen,
bevestiging volgt"**, never to paid/finalized. Admission proves neither global
propagation nor canonical execution. Keep the existing `sendTransaction` API's
wait-for-confirmation behavior unchanged for callers that require it.

The management receipt API separately tracks `pending`, `confirmed`, `failed`
and `unknown`, with durable canonical reconciliation. A timeout or an `unknown`
receipt is not proof of failure; reconcile before retrying or delivering goods.
There is no payment frontend in this workspace to wire the display into;
this change reuses and documents the existing status APIs rather than
inventing a second receipt store or claiming a UI was implemented.
