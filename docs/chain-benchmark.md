# Full-runtime chain benchmark

This benchmark compares the published `@leofcoin/chain@1.10.22` tarball with
the current workspace. It is **not** a codec-only comparison: the workspace also
contains consensus-state and recovery changes. Production code is never patched
by the benchmark.

## Capacity and admission upgrade: Peach 0.9

The current protocol permits **2,048 transactions and 1 MiB of encoded
transaction bodies per block**. The individual 32 KiB transaction limit,
one-second cadence, 60-block epochs, ten-second round timeout and monetary
policy are unchanged. Both block budgets are enforced during proposal selection
and validation; 2,048 transfers/s is only a count/cadence ceiling, not a guarantee.

This is an incompatible protocol release, not a local limit override. Discovery
advertises 0.9.0, and old 0.8 peers, blocks, genesis plans and stored ledger
markers are rejected. Version control also propagates storage failures rather
than silently overwriting the version. Same-major/minor patch versions remain
compatible at the ledger/block validation boundary.

The upgrade is prepared in source/build artifacts, not remotely deployed.
Existing local ledgers have not been deleted or migrated. Stop every writer,
archive and verify each complete data root, deploy matching library/worker/chain
and browser artifacts to all nodes, and explicitly reset the old testnet ledger.
`npm run validator:reset` previews the native reset;
`npm run validator:reset -- --confirm-testnet-reset` confirms it and **does not
make a backup**. Preserve wallet/account credentials and routing metadata.
There is no automatic 0.8-history migration or activation-height patch.

Bundled contracts, genesis allocations and wallet identities are unchanged.
Consequently their genesis-derived chain ID is unchanged too; isolation also
requires the protocol-version checks, not just a chain ID comparison.
Fresh ledgers produce 0.9 blocks from height zero.

Build the changed dependency chain before measuring. Do not rebuild during a run:

```sh
npm run build -w @leofcoin/lib -w @leofcoin/workers -w @leofcoin/chain
node scripts/benchmark-consensus-throughput.js --output node_modules/.cache/consensus-throughput-0.9-verifier.json
```

The saturated runner now accepts `--transactions 4096..8192` so each workload
spans multiple blocks, and `--output path` keeps earlier results intact. It
times only four-validator draining, then independently verifies full cold sync
and durable restart of the enlarged blocks. Those recovery phases do not
contribute to the throughput numerator or interval.

### 0.9 local capacity and admission (2026-11-14)

Signature verification still checks every new signed payload, but reuses a
bounded cache of 512 initialized public verifiers keyed by network and sender.
Initialization failures are evicted and retried; invalid signatures are never
cached as successful checks. The existing bounded cache of checks remains keyed
by the complete signed payload and network. No private keys are cached and no
signature, nonce or propagation validation is skipped.

Single runs on Apple M4 Pro / Node 26.2.0, with the same four-validator,
quorum-three loopback fixture, each preload and replicate 8,192 signed native
transfers before enabling participation:

| Metric | 0.8 baseline | 0.9 + verifier reuse |
| --- | ---: | ---: |
| Signed transfers / full blocks | 8,192 / 8 | 8,192 / 4 |
| Transfers per block | 1,024 | 2,048 |
| Inter-commit throughput | 1,029.11 tx/s | 1,563.94 tx/s |
| Median / p95 block timestamp interval | 1,001 / 1,002 ms | 1,065 / 1,407 ms |
| Signing phase | 14.445 s | 14.487 s |
| Submission phase | 41.999 s | 34.856 s |
| Preload, including replication | 57.520 s | 51.007 s |
| Drain, including first eligible block | 7.569 s | 5.147 s |
| Cold sync | 19.259 s | 19.787 s |

Submission time includes serial fixture IPC and the actual admission and
publication calls. Its approximately 17% reduction is an observation, not an
isolated cryptography or signing speedup: signing itself was essentially
unchanged. Sequential preload plus drain averages approximately 145.89 tx/s,
compared with 125.86 tx/s for the comparable 0.8 baseline; neither fixture
measures simultaneous independent wallet traffic or production WAN ingress.

The four validators, a cold observer and its restarted process passed exact
history, nonce, recipient balance and supply audits. A separate four-validator
test passed minority-quorum rejection, partition healing and precommit
crash/restart. These are isolated loopback tests, not a rollout. The 0.9 rate
uses just three inter-commit intervals, so it is not a robust network capacity
or payment-latency percentile. Full blocks took longer than the one-second
target in this run. Blocks and transaction bodies remain separate.

The reports are `node_modules/.cache/consensus-throughput-0.8-ingress-baseline.json`
and `node_modules/.cache/consensus-throughput-0.9-verifier.json`. Runtime
fingerprints remained unchanged during each run. Existing ledgers were not reset
or migrated and no remote validator was deployed.

### Bounded block-validation reads

Block validation reads pending transaction bodies in groups of at most 128,
checks every body against its reference, and verifies every signature. If a
batch contains a missing or concurrently removed entry, individual reads
preserve the existing transaction-store/network fallback. Other storage errors
and malformed batch results fail explicitly. Nonce ordering, block limits,
wire messages and separation of transaction bodies from blocks are unchanged.

Two local four-validator runs each preloaded 8,192 transfers and committed
four full 2,048-transaction blocks:

| Metric | Before | Bounded reads |
| --- | ---: | ---: |
| Individual pending-pool `get` calls per validator during drain | 16,384 | 2,048 |
| Pool `batch` calls per validator during drain, including writes | 4 | 116 |
| Inter-commit throughput | 2,053.54 tx/s | 2,046.50 tx/s |
| Serial submission phase | 31.185 s | 30.392 s |
| Cold sync | 18.143 s | 18.121 s |

These are single loopback runs using three inter-commit intervals, not a
demonstrated throughput or ingress improvement. The count/cadence limit is
already approximately 2,048 small transfers/s; concurrent wallet ingress,
signing workers and WAN capacity were not measured by this saturated fixture.
The bounded-read change itself did not add signing workers or batched ingress;
the later local admission change is measured below.
Each run also audited all four validators, a cold observer and its restart.
The reports are `node_modules/.cache/consensus-throughput-0.9-batch-read-baseline.json`
and `node_modules/.cache/consensus-throughput-0.9-batch-read-verified.json`.

### Local batch admission and bounded signing

The local `sendTransactions` API accepts 1–128 signed transactions, validates
each signature and nonce, and requires atomic pool writes. Native LevelDB
supports these writes; browser OPFS does not, so browser batch admission is
explicitly rejected and single-transaction submission remains available.
Validation or persistence failure rejects the whole batch. After persistence,
each ordered result is fulfilled with a receipt or rejected with the error and
its receipt; admission is not canonical confirmation. Publication uses the
existing individual messages and wire format.

`signTransactions` preserves input order and allows 1–32 concurrent async
signing calls. It does not move keys to workers or promise multicore signing.
The interactive launcher signs and submits each transaction individually,
while retaining bounded concurrent submissions and individual journal writes.

One baseline and one batched four-validator loopback run each preloaded 4,096
signed transfers and committed two full blocks. The latter used signing
concurrency 8 and batch sizes up to 128:

| Metric | Individual | Batched |
| --- | ---: | ---: |
| Signing | 6.824 s | 6.840 s |
| Admission | 15.138 s | 11.420 s |
| Replication wait | 0.864 s | 2.346 s |
| Complete preload | 22.836 s | 20.615 s |
| Drain including first eligible block | 1.840 s | 1.846 s |
| Inter-commit throughput | 1,982.07 tx/s | 2,028.57 tx/s |
| Cold sync | 9.388 s | 9.213 s |

These are single observations, not proof of a sustained speedup: admission
includes fixture IPC, preload includes replication, and the inter-commit rate
uses only one interval. Signing did not measurably improve, and the fixture
does not measure interactive journal overhead, WAN traffic or live concurrent
ingress. Four validator audits, cold sync and restart passed in both runs;
runtime fingerprints remained unchanged within each run. Reports:
`node_modules/.cache/consensus-ingress-baseline-4096.json` and
`node_modules/.cache/consensus-ingress-batched-4096-clean.json`.

The payment benchmark also accepts `--output` and `--delivery-delay-ms`.
The delay applies only to incoming transaction, consensus and block pubsub
messages in the isolated test fixture; it is not a WAN or bandwidth simulator.
For example:

```sh
node scripts/benchmark-payment-latency.js --samples 20 --delivery-delay-ms 50 --output node_modules/.cache/payment-latency-0.9-batch-read-delay-50-verified.json
node scripts/test-consensus-runtime.js --blocks 4 --output node_modules/.cache/consensus-runtime-0.9-batch-read.json
```

In one low-load loopback run with four validators and a nominal 50 ms delayed
delivery of those messages, all validators observed delayed messages and 20
payments reached durable confirmation on all four with p95 927 ms and maximum
956 ms. This small sample does not establish a WAN confirmation percentile.
The fault gate separately passed minority rejection, partition healing,
precommit crash/restart, cold sync and durable restart.

## Peach 0.8 results (historical)

### Initial 0.8 result (2026-11-13)

One complete passing run on the same Apple M4 Pro / Node 26.2.0 loopback setup
preloaded and replicated 8,192 signed native transfers across four validators
(quorum three):

| Metric | Optimized 0.7 | Protocol 0.8 |
| --- | ---: | ---: |
| Committed transfers / full blocks | 8,192 / 32 | 8,192 / 8 |
| Transfers per full block | 256 | 1,024 |
| Inter-commit throughput, excluding the first eligible block | 255.70 transfers/s | 665.65 transfers/s |
| Median block timestamp interval | 1,001 ms | 1,474 ms |
| p95 block timestamp interval | 1,002 ms | 1,955 ms |
| Signing, admission and replication before participation | 53.210 s | 52.598 s |
| Backlog drain duration | 31.495 s | 12.809 s |

This is approximately **2.60 times** the earlier saturated inter-commit rate,
not four times the actual measured throughput. Processing larger blocks takes
time: the cadence target is still one second, but observed intervals under this
load exceed it. The 0.8 measurement has only seven inter-block intervals versus
31 in the 0.7 run, so neither its timestamp p95 nor a single local sample
establishes normal-payment latency or WAN capacity.

All four validators passed exact history and financial audits: nonce 8,192,
recipient balance 819,200 atoms, 8,192 native transfers, eight validator snapshot
executions and conserved supply. A cold observer independently fetched/executed
all eight enlarged blocks in 19.469 seconds, passed the same audit and retained
the identical tip, history and balances after durable restart. A separate
four-validator fault gate passed minority rejection, partition healing and a
precommit crash/restart. Runtime fingerprints remained unchanged.

The approximately 665.65 figure excludes signing/admission. Including the
sequential preload and drain phases gives approximately 125.25 transfers/s in
this fixture; the drain-only rate is 639.54 transfers/s. This does not establish
sustained external admission at 665.65 transfers/s. Transaction bodies remain
separate from block headers, and no benchmark-specific production hooks exist.

The passing report is `node_modules/.cache/consensus-throughput-0.8.json`.
An initial run is retained separately at
`node_modules/.cache/consensus-throughput-0.8-initial.json`: its four validator
audits passed, but the new benchmark waited for an optional event `hash` field
instead of the canonical history target and timed out during its cold-sync gate.
The runner now uses the canonical target hash and requires passing recovery
audits; no performance result from the failed run is promoted to a passing one.
The previous 0.7 result at `node_modules/.cache/consensus-throughput-result.json`
is not overwritten.

### Local pending-body reuse (0.8, 2026-11-13)

Proposal validation and ancestry resolution now reuse durable local pending
transaction bytes rather than retrieving the same already-replicated bodies
again through Peernet. Every body still passes reference-hash validation, and
block signature, nonce, resource and economics validation remains intact.
Only `NotFoundError` falls back to canonical-store/network retrieval, including
an entry removed during a concurrent commit; I/O failures and corrupt local
bodies fail explicitly. Pending-only data does not become a public canonical
provider. Header fee totals are also derived from the same per-transaction fee
entries instead of encoding transactions a second time just to recalculate
the total.

```sh
node scripts/benchmark-consensus-throughput.js --output node_modules/.cache/consensus-throughput-0.8-local-pool.json
```

The same four-validator, quorum-three, preloaded 8,192-transfer workload passed:

| Metric | Initial 0.8 | Local pending-body reuse |
| --- | ---: | ---: |
| Full blocks / transfers per block | 8 / 1,024 | 8 / 1,024 |
| Observed inter-commit throughput | 665.65 transfers/s | 1,026.69 transfers/s |
| Median block timestamp interval | 1,474 ms | 1,001 ms |
| p95 block timestamp interval | 1,955 ms | 1,002 ms |
| Backlog drain duration | 12.809 s | 7.507 s |
| Cold sync, after the measured phase | 19.469 s | 18.633 s |

This is approximately 54% higher observed inter-commit throughput with
**unchanged** protocol 0.8 limits and one-second cadence. In practical terms,
the saturated run now approaches the 1,024-transfer/s count/cadence ceiling.
The short seven-interval commit window reports slightly more than 1,024 because
notification/processing delays at its boundaries differ; block timestamps
remain 1,000–1,002 ms apart. This is not evidence that the protocol ceiling
has increased. Neither block timestamp p95 nor a single local run establishes
payment confirmation latency or WAN capacity.

All four validators passed exact history and financial audits, as did a cold
observer and its durable restart. Each agreed on all 8,192 transfers, nonce
8,192, recipient balance 819,200 atoms, eight validator snapshots and supply
conservation. The runtime fingerprint was unchanged. Twenty focused
resolution/signature/admission checks and the chain/browser/manager builds
passed, along with static asset validation.

Signing/admission/replication took 47.847 seconds before participation; including
that sequential preload and the drain gives approximately 147.99 transfers/s
for this fixture, not 1,026.69 end-to-end transfers/s. Reports now include
per-validator operation timings reset immediately before participation. Their
cumulative durations overlap and include queue waits, so they are not exclusive
CPU samples and must not be summed as wall time. This optimization does not
change the protocol version, genesis, wallet identity or ledger compatibility.

## Clean Peach 0.7 (historical)

The previous clean 0.7 runtime introduced a fresh genesis, one-second cadence and
60-block epochs. The issuance calculation uses 31,536,000 blocks per 365-day year,
preserving the 2%-of-target annual ceiling. The 10-second round timeout and
transaction/byte limits remain unchanged. The earlier protocol 0.6 measurements
below are historical; fresh 0.7 throughput results are listed separately.

The regenerated Peach chain ID is
`lfc:04c99e3b35cb18b32fc49d2a01ef6bb85a690622cf416880087edb1c456f59fb`.
The original genesis validator and allocations remain unchanged: 50,000,000 LFC
initial supply against a 1,000,000,000 LFC target. The local old ledger and old
genesis artifacts were privately archived and every copied ledger file was
SHA-256 verified before the scoped reset. Wallet/account identity was preserved.
The actual reset root passed offline contract-hash, empty-history, initial-supply
and native-metadata checks without starting networking.

The fresh runtime passed the four-validator gate with quorum three, minority
partition rejection, healing, a precommit crash/restart, 12 committed transfers,
cold synchronization and durable restart. Audits checked exact history, nonces,
balances and conserved supply. Focused replay checks also passed crashes at each
checkpoint boundary and rejection of invalid proofs, execution and nonce gaps.
The actual epoch transition is checked at the 60-block boundary. These are local
correctness checks, not new p95 latency or sustained-TPS measurements. Other
nodes still require coordinated deployment of the same new genesis and ledger
reset; no remote rollout is implied.

## Throughput measurement (2026-11-13, protocol 0.7; historical)

The unmodified one-second runtime was measured on an Apple M4 Pro / Node 26.2.0:

```sh
node scripts/benchmark-chain.js --current-only --transactions 8192 --batch-size 512 --samples 3 --timeout-ms 120000 --output node_modules/.cache/chain-throughput-0.7.json
```

| Metric | Result |
| --- | ---: |
| Transfers per run / repetitions | 8,192 / 3 |
| Committed blocks per run | 47 |
| Median end-to-end throughput, including signing/admission | 161.92 transfers/s |
| Median inter-commit throughput, excluding the first eligible block | 165.06 transfers/s |
| Inter-commit throughput range | 163.60–165.38 transfers/s |
| Median end-to-end duration | 50.592 s |
| Median aggregate signing time | 14.224 s |
| Median cold-sync duration | 17.415 s |

This workload uses one validator and a live follower, then checks a cold observer
and its durable restart. All three runs passed exact balances, committed nonces,
transfer membership/counters and supply conservation on all four audited states.
Runtime fingerprints remained unchanged. Batch feeding leaves some blocks
partially filled; neither the end-to-end nor inter-commit rate is a demonstrated
maximum capacity for a continuously saturated multi-validator network.

A separate loopback four-validator run preloaded and replicated 8,192 signed
transfers before enabling participation (quorum three). All four validators
committed the same first block of 256 transfers, but the backlog did not progress
to another committed block before the 120-second drain timeout. Increasing the
wait from the initial 45-second attempt did not resolve it. At that stage **no
valid four-validator saturated TPS result was available**. The report retains the
failure/events/logs at
`node_modules/.cache/chain-throughput-0.7-four-validators.json`; this is diagnostic
evidence, not a passing performance result. Benchmark processes were stopped.

The count/cadence ceiling is still at most **256 transfers/s** for small
transactions (256 per block, one-second target); larger transactions may hit
the 128 KiB body limit earlier. This is a protocol upper bound, not a measured
guarantee. The corrections and measurements below address the stalled backlog
without changing these consensus limits.

### Saturated four-validator progress and signature-cache correction

Ordinary peer commits previously cleared the round timer without waking the
next proposer unless another transaction arrived. Every durable live commit now
wakes an idle participating validator when pending transactions remain. Epoch
markers still reset only at epoch boundaries, and recovery replay does not
schedule production.

The signature-verification cache also previously held only 4,096 entries.
Preloading 8,192 transactions evicted the early successes; checking them again
during proposals evicted the later successes in turn. Its bound is now 16,384.
Cache keys still bind the exact encoded signed bytes and network; failed checks
are removed, and old successes are still evicted once the bound is reached.
Neither verification rules nor wire formats change.

```sh
node scripts/benchmark-consensus-throughput.js
```

The same local Apple M4 Pro / Node 26.2.0 workload preloads and replicates 8,192
signed native transfers across four validators before enabling participation
(quorum three). These are single-run observations with unchanged protocol 0.7
cadence and limits:

| Metric | Commit scheduling fixed | Scheduling and cache fixed |
| --- | ---: | ---: |
| Transfers / full blocks | 8,192 / 32 | 8,192 / 32 |
| Inter-commit throughput, excluding the first eligible block | 198.20 transfers/s | 255.70 transfers/s |
| Median block timestamp interval | 1,259 ms | 1,001 ms |
| p95 block timestamp interval | 1,424 ms | 1,002 ms |
| Signing, admission and replication before participation | 51.674 s | 53.210 s |
| Backlog drain duration, including the first eligible block | 41.421 s | 31.495 s |

The cache correction improves the inter-commit rate by approximately 29% for
this same saturated workload, approaching the existing 256-transfer/s count
ceiling. All four validators agree on the final tip, exact transfer membership,
nonce 8,192, recipient balance 819,200 atoms, 8,192 native transfers, 32 validator
snapshot executions and supply conservation. Runtime fingerprints remain
unchanged during each run; the runner shares the full-runtime fingerprint
helper with the batch-fed benchmark.

The scheduling-only report is retained at
`node_modules/.cache/consensus-throughput-scheduling-only.json`; the latest
combined result is `node_modules/.cache/consensus-throughput-result.json`.
The original stalled report remains separate. That version of the runner accepted
`--transactions 512..8192`, wrote a failure report and exited unsuccessfully if
draining or any audit failed, and cleaned up its isolated nodes.

This is loopback WebRTC with a trusted fixture anchor and preloaded transfers,
not a genesis-validation, WAN, payment-latency or continuously fed ingress test.
The approximately 255.70 figure excludes signing/admission and is not directly
comparable to the earlier batch-fed end-to-end result. Including the sequential
preload and drain phases gives approximately 96.71 transfers/s in this fixture;
its drain-only rate of 260.10 includes an immediately eligible first block and
must not be presented as steady-state throughput. The timestamp p95 describes
block spacing, not payment confirmation latency. Higher transaction counts or
byte limits require a coordinated, versioned protocol upgrade rather than
silently changing what existing 0.7 validators accept.

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
512 to bound signing/IPC payloads, independently of 0.9's larger block limit).
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
anchor at height zero and stakes a generated test account. The current workspace
uses clean protocol 0.9 with one-second cadence; the published baseline retains
its six-second cadence. Reports disclose this difference, so a new comparison
is not an isolated codec/selection speedup. This is a synthetic
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

## Historical one-second payment-latency experiment (protocol 0.6)

The historical measurement used an isolated timing override to compare one and
six seconds. That override has since been removed from the core and fixtures;
the current latency script measures only the unmodified one-second runtime.
This was an isolated experiment, not protocol activation. Production genesis,
protocol version, block limits, rewards, epochs and the 10-second consensus
round timeout were unchanged for these measurements. Protocol 0.7 introduced
one second by default, 60-block epochs and issuance scaled to 31,536,000
blocks per year. These earlier latency percentiles were not remeasured after
the fresh genesis. There is no benchmark timing configuration or timing
environment-variable override in the current core.

```sh
npm run build -w @leofcoin/chain
node scripts/benchmark-payment-latency.js --samples 20
```

The script starts four independently signed validators on private temporary
stores and loopback WebRTC discovery. Quorum remains three. After one unmeasured
warm-up payment, 20 single-payment arrivals are spread deterministically across
the proposal interval. The parent monotonic clock measures signing, admission,
and receipt of each validator's post-checkpoint block notification. Confirmation
requires all four validators, not just a proposer acknowledgement. The script
checks actual block timestamps against the one-second interval and independently
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
deployment must follow the coordinated 0.9 rollout described above and still
needs measurements across realistic validator links.
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
