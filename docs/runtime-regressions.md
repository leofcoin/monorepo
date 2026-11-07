# Runtime regression checks

## Offline node startup and process cleanup

`npm test -w @leofcoin/chain` checks the actual `chain.ready`, `chain.loaded`
and `chain.state.chain`, never console formatting. Failed process operations
settle before temporary stores are removed, so a sibling cannot keep writing
into a directory being deleted. Regression tests cover that failure ordering.

## Four-validator consensus

After building core packages, run:

```sh
npm run test:e2e:consensus-runtime
# Longer local run:
npm run test:e2e:consensus-runtime -- --blocks 32
```

The default uses four separate validator processes, their real signatures, real
loopback WebRTC and twelve produced blocks, crossing an epoch boundary. All stores
are under one private temporary directory. It never opens the user's wallet.

The shared fixture uses the bundled contracts and an explicit trusted height-zero
state with four funded/staked fixture validators. This is not public genesis
generation or a public-network acceptance test. After setup, the regular runtime
produces, authenticates, votes, commits, persists and recovers blocks unmodified.
Test-only message-boundary faults do not alter quorum rules:

- Two validators can propose but cannot finalize without the third vote.
- After message delivery is restored, round timeouts must allow convergence.
- A validator is killed immediately before publishing its precommit and restarted
  with the same identity and stores. The remaining quorum must keep progressing.
- A fresh observer cold-syncs the complete history and restarts from persisted
  state. Every block hash, parent link and transaction set must match exactly.
- All nodes must agree on recipient balance, sender nonce, execution counters and
  conservation of token supply. Replays cannot duplicate transfer effects.

The JSON report is saved to `node_modules/.cache/consensus-runtime-result.json`.
This is a bounded regression scenario, not proof of Byzantine safety or sustained
mainnet capacity. It does not cover arbitrary packet schedules, long-running
membership churn or disk failure at every instruction boundary.

## Payment preview and confirmation

Preview reads the public account, canonical balance and next transaction fields;
it never obtains a private signer or broadcasts a transaction. The fee estimate
uses the current Schnorr signature framing and a maximum-length body. Confirmation
signs a fresh transaction and recalculates the exact fee, rejecting a total above
the reviewed estimate. Account/network/input changes and stale asynchronous
preview replies cannot silently replace the reviewed payment.

`npm test -w @leofcoin/node` covers preview, precision, stale replies and errors.
After building the browser node, run the opt-in UI cases with a local Chrome:

```sh
cd packages/node
RUN_SHELL_UI_TESTS=1 CHROME_BIN='/path/to/chrome' \
  node --test --test-name-pattern='payment' test/shell-ui.test.js
```

These UI tests use only a simulated node. They verify desktop/mobile layout,
network mismatch protection, zero preview signatures, one signature/submission
on Confirm, and zero signatures/submissions on Cancel. Payment review has no
wallet tabs or secondary actions; the ordinary wallet routes retain navigation.
