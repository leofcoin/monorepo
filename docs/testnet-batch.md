# Deliberate Peach testnet transaction bursts

## Simplest option: the existing wallet shell

With the local node stopped, run just:

```sh
npm run testnet:batch
```

This opens a normal node with its existing wallet and starts the wizard. Use
`npm run testnet:batch -- --interactive --root /path/to/existing/root` to select
a different root; normal CLI password/network options are supported. It does
not start validator participation. It may need time to sync before accepting
a burst; if not yet synced, use the normal running node shell instead.
It refuses a root without existing native account/wallet stores rather than
creating a new wallet.

Start your usual node/validator with its existing wallet, then type:

```text
leofcoin> batch
```

The wizard asks for count, recipient (self by default), amount and concurrency.
It reuses the already unlocked signer: no separate export, password or endpoint
is needed. Confirm preparation with `yes` and actual submission with `SEND`.
Fees/balance/nonce are checked and receipts are saved automatically. Local
validator heartbeats pause during the wizard. See the
[interactive wallet guide](../packages/launch-chain/README.md#interactive-testnet-batch).
Never start a second process against the same root while the original node runs.

## Standalone automation

Use only on nodes and a testnet network you own or have permission to load.
This script does not start a validator, participate in consensus, read the node's
wallet databases, or change genesis. Never reuse a mainnet or validator signing
key for load tests. Only Peach's verified chain identity is accepted.

Build and deploy matching chain, endpoint and endpoint-client artifacts first:

```sh
npm run build -w @leofcoin/chain -w @leofcoin/endpoints -w @leofcoin/endpoint-clients -w @leofcoin/launch-chain
npm run test:testnet-batch
```

The chain build includes a backlog fix: proposal validator fees are computed from
the transactions actually selected for that block, not the remaining mempool.
Restart your testnet nodes with the new artifacts before a large burst.

## Preview (no transactions sent)

```sh
npm run testnet:batch -- \
  --endpoint http://127.0.0.1:8080 \
  --from YOUR_TEST_SIGNER_ADDRESS --to TEST_RECIPIENT_ADDRESS \
  --count 100000 --amount 1 --concurrency 32
```

The endpoint must be synced and connected. Amount is an integer number of atoms
per transfer, not a decimal token quantity. Counts may be smaller or larger than
100,000; positive safe integers are accepted. Concurrency is 1–1024.

## Sign locally and enqueue the burst

Use an encrypted string exported by `MultiWallet.export(password)` for the exact
signing account whose `wallet.address` matches `--from`. A root wallet export is
not automatically a derived account's signer. Password and wallet are supplied
through explicit files, never command-line values or the node's saved identity.
Keep both outside git and restrict their permissions. No credentials are sent
to the HTTP endpoint or written to the receipt journal.

```sh
npm run testnet:batch -- \
  --endpoint http://127.0.0.1:8080 \
  --from YOUR_TEST_SIGNER_ADDRESS --to TEST_RECIPIENT_ADDRESS \
  --count 100000 --amount 1 --concurrency 32 \
  --wallet-file /private/path/test-signer.encrypted \
  --password-file /private/path/test-password.txt \
  --output /private/path/burst-100000.receipts.jsonl \
  --confirm-testnet-send
```

Use a dedicated funded sender with no other scripts, heartbeats or wallet UI
submitting from it. The script signs the entire workload first, assigns unique
increasing nonces after the endpoint's latest committed/pending nonce, sums exact
fees, checks that balance covers transfers plus fees, and rechecks the nonce
before sending. Preparing 100,000 signed transactions uses time and memory;
signing is not instantaneous and extremely large counts can exhaust memory.

Once prepared, it sends without waiting for block confirmation or draining the
mempool between batches. `--concurrency 32` means at most 32 in-flight HTTP
requests; all 100,000 are offered as quickly as signing, admission, networking
and durable journal writes allow. It does not create 100,000 sockets at once.
Start small; use concurrency 1 if strict admission ordering is needed.
Parallel/network delivery can reorder same-sender nonces; this script does not
provide a cross-client nonce reservation or consensus ordering guarantee.

## Receipts and failures

`/submitTransaction` returns `admitted` after local pool admission, **not**
finalization or network-wide delivery. Actual blocks retain their transaction
count/byte limits and cadence. The original `/sendTransaction` route still waits
for canonical completion.

The new JSONL journal is created exclusively (no overwrite), with mode 0600.
It saves and syncs intent before each request, then its hash/nonce/status. The
final summary distinguishes requested, attempted, admitted and unsent counts;
`finalized` remains false. Inspect canonical transaction membership and balances
with the explorer to establish completion. Admission alone is not a TPS result.

An error or Ctrl-C stops new submissions and drains in-flight HTTP requests.
A timeout, failed HTTP response or mismatched receipt is recorded as `unknown`:
the transaction might already be in the pool or eventually finalize. There is
no automatic retry or resume. Reconcile the journal's hashes and the sender's
pending/committed nonces before another run, especially when a missing lower
nonce would leave a gap. Already admitted transactions are not cancelled.

The script is not run against live testnet merely by adding it to the repository.
