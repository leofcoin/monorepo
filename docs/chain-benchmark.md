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
anchor at height 0 and stakes a generated test account. This is a synthetic
checkpoint fixture, **not a new production genesis or a genesis-validation test**.

Signed transfers enter through a second node and propagate to the producer.
Timing includes admission, signature verification, networking, consensus,
execution, producer checkpoint persistence, and live-follower confirmation.
Signing is now included and separately reported as `signingMs`; fixture setup is
excluded. Earlier reports excluded signing and are not directly comparable.
The old anchor timestamp makes the first block immediately eligible;
`transactions / elapsed time` is therefore **batch throughput, not sustained TPS**.
No production timing or economics rules are changed.

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
