# Leofcoin Chain Manager

A standalone web and Electron operator console. It does not share the webnode's
wallet or chain stores, start validator processes, reset existing chains or
silently change monetary policy.

## Run

From the repository root:

```sh
npm install
npm run build
npm run build -w @leofcoin/chain-manager
npm run serve -w @leofcoin/chain-manager
```

Open `http://127.0.0.1:9580` (`PORT` overrides the port). The generated `dist/`
directory can be hosted as a static site. Use HTTPS outside localhost because
Web Crypto requires a secure context.

Desktop:

```sh
npm start -w @leofcoin/chain-manager
npm run pack -w @leofcoin/chain-manager
npm run dist -w @leofcoin/chain-manager
```

Electron loads local assets without a web server, Node.js renderer integration
or a preload bridge. Context isolation, sandboxing and browser security remain
enabled. External navigation/windows are blocked. The content policy permits
WebAssembly for the shared cryptographic library, not JavaScript `eval`.
Build output goes to `release/`. Distribution requires your own platform signing
and notarization credentials.

## Connect an existing chain

Add a name and HTTP(S) node endpoint under **Chains**. The manager recomputes the
reported genesis identity before saving its full chain ID. Every operation
checks the pinned identity. An operator label cannot turn mainnet into testnet:
dedicated faucet/mint tools require both an explicitly marked profile and the
supported `leofcoin:peach` namespace.

The node must run the updated [management HTTP API](../endpoints/README.md).
Rebuild/redeploy `@leofcoin/endpoints` and restart an older node. No remote wallet
access or legacy GET transaction endpoints are used. The endpoint must allow
CORS, including the Electron file origin. HTTPS-hosted pages require HTTPS
endpoints. Endpoint URLs cannot contain credentials, query strings or fragments.

The console displays actual peer count, canonical height, sync, nonce and native
balance. It does not assume that a reachable endpoint is synced or that an
endpoint's report proves consensus. Use a trusted node.

## Operator wallet

Create a wallet with a unique password of at least 12 characters and immediately
download its encrypted backup. The backup contains a versioned envelope with the
network, public address and encrypted multi-wallet payload. No mnemonic, private
key or plaintext password is persisted or sent to the endpoint.

Import uses that manager backup format, validates it and verifies the derived
account against its public address. Existing wallets are deliberately not
overwritten. Test recovery in a separate fresh app/browser profile, not by
deleting your working wallet. Export remains available while locked.

The manager uses the deterministic operator account `m/44'/coin_type'/1'/0/1`.
Unlocking is session-only. Chain changes and five minutes of signing inactivity
lock the wallet and discard a prepared transaction. Balance, nonce and chain
checks are repeated before broadcasting.

Only encrypted wallet data, public chain profiles, faucet setups and public transaction history
are stored under `leofcoin:manager:*` local-storage keys. Electron uses its own
application data directory. Storage failures are shown; no transaction is sent
if its durable activity reservation cannot be saved.

## Contracts and explicit review

**Contracts** supports public reads, signed method calls and deployments of
self-contained JavaScript contract source with JSON-array constructor parameters.
Imported module dependencies must already be supported by the runtime; this
console does not compile arbitrary npm projects or execute uploaded code locally.

Preparing signs locally to calculate the exact encoded fee, but does not
broadcast. Review displays the chain ID, endpoint, sender, target, method, params,
fee, amount and any generated contract address. Deployment review also exposes
the source and constructor inputs. Consent is reset for each review.
Reviews expire after two minutes. There is no background signing or auto-resend.

Deployments use the selected chain's genesis factory. First query its
`tokenAmountToReceive` and approve the native-token allowance through a reviewed
`approve(factoryAddress, amountInIntegerUnits)` call. The manager checks the
allowance, registration price and balance before preparing deployment.
Registration spends that LFC price plus transaction fees; the price is displayed
in review. No implicit approval transaction is sent.

Contract method parameters use integer token units as JSON strings when relevant.
For example, 1 LFC is `"1000000000000000000"`. Dedicated faucet funding accepts
human LFC decimals and converts them exactly.

## Testnet faucets

Use **Faucet → Guided faucet installation** for an end-to-end native test-LFC
setup. Enter the human claim amount, cooldown in seconds, lifetime budget and
initial funding. Funding must cover at least one claim and cannot exceed the
budget. The manager saves the configuration and deterministic contract address
locally, bound to the selected chain/profile and operator wallet.

Choose **Check setup progress**, then separately prepare, review and broadcast:

1. The exact factory registration allowance, only if the existing allowance is
   insufficient. There is no unlimited approval.
2. The template deployment, with its full source and constructor visible.
3. Initial funding, only after canonical deployment confirmation and a fresh
   read verifying that the faucet still matches its reviewed configuration.

Use **Reconcile setup transactions** between steps. Pending/unknown delivery
blocks progress; a rejected transaction may be prepared again after reconciliation.
Reloading resumes from saved configuration and activity without repeating
confirmed steps. Workflow activity is retained rather than evicted from the
200-entry history; the manager stops if no safe history slot remains.

The final verification reads the deployed configuration, current token balance
and remaining lifetime budget. It does **not** broadcast a test claim or guarantee
execution under future chain conditions; users still pay transaction fees when
calling `claim()`. One guided setup per profile/operator is supported. Use the
manual contract tools for additional/different faucet deployments.

The prefunded faucet template under Contracts is a self-contained contract.
Constructor inputs are:

```json
["NATIVE_TOKEN_CONTRACT_HASH", "1000000000000000000", 86400000, "1000000000000000000000"]
```

These mean token address, claim units, per-account cooldown in milliseconds and
**lifetime** distribution budget. The minimum cooldown is one minute. The budget
does not reset daily. The template is a starting point, not an audited production
faucet; permissionless testnet identities can evade per-account limits. The
separate [faucet service](../faucet/) also provides IP limits and durable claims.

After deployment confirms, fund the contract address under **Faucet**. Claims
call `claim()` and transfer existing tokens to the transaction sender. The owner
can call `withdraw(recipient, units)` through Contracts. Contract-state updates
and token transfers use normal chain transaction execution.

Custom-token minting to refill an account/contract is optional, testnet-only and
requires the operator's on-chain `MINT` role and supported token decimals.
Native LFC mint/burn and monetary role changes are blocked: the native contract
reserves these rights for protocol monetary policy, even for its genesis owner.
There is no automatic native mint, scheduled refill or permanently unlocked key.

## Transaction activity and recovery

Activity is persisted **before** a network submission. Admission is shown as
pending; the node's canonical completion handle or canonical block membership
produces confirmed.
Execution failure is distinct from unknown delivery. Refresh checks the selected
profile's receipts without resubmitting anything.

An unresolved transaction blocks the next preparation on the same chain profile,
avoiding accidental nonce reuse or duplicate funding. Profiles with unresolved
activity cannot be removed. Other chains remain selectable.

The updated node durably saves a reservation **before admission** in its isolated
chain store, namespaced by full chain ID. Receipts survive node/HTTP restarts.
Refreshing unresolved activity scans up to 128 canonical blocks per receipt,
saves progress and never resends. Repeat refresh for a long catch-up. Recorded
inclusion and scan anchors are rechecked against canonical blocks after restart.
Pool membership, transaction-store presence and nonce changes do not prove
confirmation. Missing/unavailable canonical data produces an explicit error.

The journal retains up to 512 receipts per chain; completed entries may be
evicted. Older pre-upgrade submissions, another node's receipts, evicted entries,
or transactions with no observed canonical inclusion remain unknown. Unknown
is not failed: consult the node operator if repeated reconciliation cannot find
the transaction. There is no unsafe one-click resend or dismissal.

## Generate a new genesis

The **Genesis** studio retains the public plan schema, checksum validation,
allocation checks and SHA-256 configuration fingerprint. It works offline after
the app has loaded. Drafts stay in memory until exported.

After reviewing the plan and acknowledging it, choose **Generate genesis bundle**.
This generates the actual four encoded genesis contract messages from the same
construction logic and bundled sources as the runtime. Their hashes and chain ID
must match the reviewed plan. The public bundle contains the plan, fingerprint,
verified identity, addresses and bytecodes, never operator credentials.

Validate/extract a downloaded bundle into a **new, nonexistent directory**:

```sh
npm run genesis:extract -w @leofcoin/chain-manager -- /absolute/path/leofcoin-genesis-bundle.json /absolute/path/new-genesis
```

Extraction recomputes every artifact and refuses tampering or an existing output
directory. It produces `addresses.json`, `bytecodes.json`, `chain-identity.json`
and `genesis-plan.json`. These are deployment artifacts for a new runtime release,
not an import/reset command for a running chain. An operator must deliberately
configure the new runtime and isolated stores, retain the matching validator
identity and start its validators outside the manager.

Changing owner, supply, allocations or genesis source changes the chain ID;
labels/discovery stars do not. A new genesis is a different chain, never an
update to an existing chain. Runtime network, token and protocol are fixed to
the supported release.

## Validate

```sh
npm test -w @leofcoin/chain-manager
npm run typecheck -w @leofcoin/chain-manager
npm test -w @leofcoin/endpoints
CHAIN_MANAGER_DESKTOP_TEST=1 npm test -w @leofcoin/chain-manager
```

Tests cover real signature verification, HTTP integration against a simulated
node, canonical pending/confirmed boundaries, ambiguous delivery, isolation,
genesis bytes/extraction and faucet limits. The desktop smoke test opens and
closes an isolated Electron window and downloads a validated public plan. These
are not live-network funding tests and never broadcast to a public chain.
