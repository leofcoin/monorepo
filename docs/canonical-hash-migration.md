# Canonical hash migration: protocol 0.4

Protocol 0.4 uses codec-format-interface 2.x and peernet 2.x together. Serialized
hashes contain `codec → digest byte length → digest`, with canonical unsigned
varints. The decoder does not support length-first hashes or padded varints.
The digest algorithm is unchanged; content-address strings change.

## Repository artifacts

`scripts/migrate-genesis-hashes.js` re-addresses the four existing public native
contract messages in dependency order, updating constructor links between them.
It preserves the owner, allocations, supply parameters, contract source and fees.
It is not `create-genesis`: it never opens a wallet, creates an identity, reads
credentials, resets stores, starts a node or changes a live deployment.

After building messages, check that committed artifacts are self-consistent:

```sh
node scripts/migrate-genesis-hashes.js
```

The explicit `--write` option updates only the two generated repository JSON
artifacts. Review their diff and run the complete build, core tests, local E2E and
browser checks before publishing. Never migrate only the address prefix: a changed
native-token hash also changes dependent contract messages and their hashes.

## Coordinated deployment, not an in-place ledger upgrade

1. Publish codec-format-interface 2.0.0 and peernet 2.0.0 first.
2. Release all changed monorepo packages and propagated dependents together,
   including addresses, lib, messages, workers, chain, launch and the browser node.
3. Stop the affected old-network processes and back up their data, identity and
   credentials outside the deployment. Preserve the existing genesis owner.
4. Use a separate new chainstate root for the reset network and restore the owner
   through the supported identity workflow. Do not copy the old ledger into it.
   Do not run `create-genesis` without a separately approved account/supply plan.
5. Deploy identical native artifacts and protocol 0.4 to every participating node.
   Keep old 0.3 nodes off the reset network; major/minor protocol checks reject them.
6. Verify exact block hashes, real transaction inclusion, finality and recipient
   balances on independent nodes, including cold-sync and restart recovery.

The startup guard rejects incompatible or unversioned persisted ledger state
before bootstrap/state initialization; it does not silently relabel or clear it.
An old root without any ledger/version metadata cannot be fully identified by
that check alone, so separate roots and backups remain mandatory.

Local E2E uses signed fixture blocks and is not proof of live validator consensus.
No public observer run against the old remote 0.3 network is a valid acceptance
test for this migration. Do not claim network convergence until the coordinated
deployment and real transaction checks have completed.
