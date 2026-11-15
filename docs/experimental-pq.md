# Experimental private PQ chain

**Disposable, private test chains only. Not a mainnet upgrade, funds migration,
or claim that Leofcoin/Peernet is quantum-safe.** No production activation
constants, old block replay rules, bundled genesis, or shared address exports
are changed. Existing launch-chain/validator CLI and faucet tooling are not PQ
launchers.

## Boundary and cryptography

- Exactly one node and one chain per Node.js process / isolated browser realm.
  Run multiple validators in separate processes with separate roots. A PQ
  reservation survives failed startup: restart in a fresh process, do not try
  to clear globals. Existing stores in the realm and repeated initialization
  are rejected. Persistent roots are pinned to their genesis before bootstrap.
- Network: `leofcoin:pq`. No default bootstrap peers. Only explicitly supplied
  loopback `ws://` / `wss://` stars are accepted. There is no public deployment.
- FIPS 204 ML-DSA-87 via exactly `@noble/post-quantum@0.7.1`. The provider takes
  a **64-byte BIP39 seed**, not a mnemonic or a secp256k1 private key.
  HKDF-SHA512 derives 32 keygen bytes: salt is UTF-8
  `leofcoin:ML-DSA-87:v1`, info is UTF-8 `leofcoin:pq`, a NUL delimiter, then
  the canonical decimal uint32 account index (default `0`). No chain ID enters
  key derivation. Recovery requires the same BIP39 passphrase and account index.
- Address: `lfc-pq1:` followed by exactly 5184 lowercase hex characters encoding
  the full 2592-byte public key. It is not a classical MultiWallet address,
  ID, or MultiWIF; the separate `PqWallet` provider uses this address scheme.
- The **existing canonical 32-byte transaction digest** is the ML-DSA message,
  using the FIPS context `Leofcoin:ML-DSA-87:v1:<chainId>`. This is pure ML-DSA
  applied to that digest, not a new HashML-DSA wire variant. Signature fields
  remain Base58 strings carrying exactly 4627 raw signature bytes, without a
  legacy MultiSignature header. Signatures are randomized; key recovery is
  deterministic. Existing hash/resource limits still constrain overall
  security and throughput; ML-DSA-87 alone does not establish a system-wide
  category-5 security guarantee.
- Transactions, proposal/prevote/precommit authentication, and producer proofs
  enforce PQ-only verification. Classical networks reject PQ addresses. There
  is no algorithm fallback or signature-suffix truncation in the PQ path.
  Beacon identity-message verification accepts the same explicit PQ chain
  context, but **BLS threshold proofs/DKG and ECDH share envelopes remain
  classical**; no PQ beacon activation is added. Peer transport encryption and
  authentication are not upgraded.

## Genesis and startup (Node API)

Use the **matching chain entry points** for providers/builders and launchers;
in browser bundles use `@leofcoin/chain/browser/pq`, `/browser/node`, and
`/browser/chain`. This keeps the validated-context registry and provider class
shared with the bundled launcher.

```js
import Node from '@leofcoin/chain/node'
import Chain from '@leofcoin/chain/chain'
import { PqIdentity, PQ_NETWORK, createPqGenesis } from '@leofcoin/chain/pq'

// Call only in a fresh process, with a caller-provided seed and dedicated root.
export async function startFirstValidator(bip39Seed, root) {
  const identity = new PqIdentity(bip39Seed)
  const creator = identity.selectedAccount // available before genesis
  const genesis = await createPqGenesis({
    creator,
    target: '1000000000000000000000000', // canonical integer base units
    initial: '1000000000000000000000000',
    allocations: [{ address: creator, amount: '1000000000000000000000000' }]
  })
  const options = {
    network: PQ_NETWORK, genesis, identity, root, stars: [], autoStart: false
  }
  const node = new Node(options)
  await node.ready
  const chain = new Chain(options)
  await chain.ready
  await chain.participate(creator)
  return { node, chain, genesis, identity }
}
```

Supply at most 100 unique PQ allocations. The creator must be funded and
allocations must sum to initial supply, which must not exceed target supply.
Public contract sources come from the reviewed bundled native contracts;
arbitrary supplied executable genesis sources are not accepted.

Distribute the **same public genesis bundle** to every process, including
restarts. Imported JSON must pass `validatePqGenesis(bundle)` from the matching
`/pq` entry before passing it to `Chain`. The validator's provider need not be
the genesis creator: other funded PQ accounts can register through ordinary
PQ-signed approval/validator transactions. No quorum/membership rules are
relaxed.

The bundle contains only public contract bytes, addresses and the existing
`leofcoin:chain-identity:v1` ID computed from those contract hashes and network.
Validation rebuilds the contracts and verifies all bytes/links/hashes. Context
is frozen and passed to each canonical/read-only worker, including restoration;
it never replaces global bundled genesis constants.

After Node startup the provider is bound to the validated chain ID. Before
that it refuses signing, and it refuses rebinding to a different chain.
`signTransaction(rawTransaction, identity)` from `@leofcoin/lib` signs normally;
use `chain.nativeToken` or `genesis.addresses`, never bundled classical
addresses. PQ blocks require the current protocol version and consecutive
nonces starting at height zero; the classical height-14 schedule is unchanged.

The chain-side `PqIdentity` helper is deliberately **volatile** and never writes
secrets to Peernet's stores. The separate `PqWallet` provider in
`@leofcoin/multi-wallet` uses the same derivation and signing scheme and offers
an encrypted seed backup; it does not use or emit classical MultiWIF files.
Back up the 24-word BIP39 phrase securely. `destroy()` best-effort erases live
secret material; JavaScript cannot guarantee complete memory erasure. No
seed/private key is included in defaults or genesis artifacts.

## Validation and limitations

Build dependencies with `npm run build:core`, then run:

```
npm test -w @leofcoin/lib -w @leofcoin/workers -w @leofcoin/chain
```

Tests cover deterministic recovery, malformed/exact lengths, tampering,
cross-chain replay, no downgrade, all vote types, beacon identity signatures,
browser provider wiring, realm reservations, immutable genesis, and a real
single-validator process committing block zero, restarting from checkpoint,
fully replaying from genesis, and refusing a conflicting genesis root.
Replay also rejects a re-hashed block carrying an invalid producer proof.

The browser test checks bundled cryptography/provider injection, **not** a
real browser's storage/WebRTC lifecycle. The runtime test is single-validator:
it does not establish Byzantine resilience or multi-validator network safety,
timing, throughput, or recovery under partitions. Larger PQ identities and
signatures require further network/load/fault testing before any broader use.
