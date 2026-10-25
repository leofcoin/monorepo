# Browser node and wallet

## Chain manager

Open `#!/manager` to plan a Peach genesis without unlocking a wallet or starting
a node. Choose the initial supply and monetary-policy target, enter the public
genesis-validator address, and distribute the exact initial supply between
accounts. Import/export uses a versioned public JSON schema, account checksum
validation and a reproducible SHA-256 configuration fingerprint.

Plans also carry `chainId` (`lfc:` plus a 256-bit digest), derived from the network
namespace and the four canonical genesis-contract hashes. The planner uses the
bundled genesis contract sources; the generator shares the same construction
logic. Labels and discovery stars do not change identity. Owner, supply,
allocations, or genesis code changes do. Imported IDs are recomputed and checked.
Regenerate older planning exports that do not contain an ID.

Review offers **Check connected nodes**. An unlocked running node checks its
own identity and up to 16 connected peers with a three-second observation limit.
Outcomes are found, not observed among responding peers, or unknown when responses
are missing/unsupported. This is not a global registry, an ID reservation,
an automatic connection to every star, or proof of finalized consensus.
Runtime nodes expose the public identity through the `chainIdentity` peer request
and the read-only HTTP `/chainIdentity` endpoint. Older deployed nodes need the
updated package to answer; their absence is not treated as an available ID.

This is a **plan, not a generated genesis or a running chain**. Token metadata,
network and protocol are fixed to the supported runtime; the target is not a hard
supply cap. The wizard never creates identities, changes balances or resets
stores. Keep passwords, keys and encrypted identity backups separate.

Validate the exported file locally (read-only, from the repository root):

```sh
npm run genesis:validate -- ./leofcoin-genesis-plan.json
```

The existing genesis generator continues to use its explicit environment inputs;
the plan is not applied automatically. Operator-controlled genesis generation,
runtime fingerprinting and chain import are separate follow-up work.

For an isolated UI fixture with no wallet, node or transactions, run
`npm run test:ui -w @leofcoin/node` and open `http://127.0.0.1:9556/manager`.

## Wallet

The browser runs its own Peach node and stores its encrypted identity locally.
Sending is enabled only after chain sync and a peer connection. Review shows
the recipient, amount, signed transaction fee and total. Acceptance by the local
node is shown as pending; only canonical completion shows confirmed.

To test locally:

```sh
npm ci
npm run build
npm run build -w @leofcoin/node
npm run serve -w @leofcoin/node
```

Open `http://localhost:9555`. Create a wallet, save the mnemonic/password or
export an encrypted backup from Identity, and copy the Receive address. A
testnet operator must fund that address with test LFC. There is no automated
faucet in this release. Test LFC has no monetary value.

Once connected and synced, review and send a small transfer to another test
wallet. Verify the canonical confirmation and the receiving node's balance.
Active validators must be online; a pending transaction is not proof of
confirmation. Keep the browser open while waiting. Activity retains up to 100
transfers submitted by this browser; it is not a full chain-history index.

Run signing, encrypted-backup recovery and transfer-boundary tests with:

```sh
npm test -w @leofcoin/node
```

For repeatable UI testing without broadcasting transactions:

```sh
npm run test:ui -w @leofcoin/node
```

Open `http://127.0.0.1:9556`. This separate-origin fixture starts with a simulated
100 LFC balance. Enter a recipient and amount, review, submit, and click
**Finalize simulated transaction**. Confirm the pending/confirmed distinction,
balance refresh and Activity update. **Disconnect** checks sending is blocked
when the peer disappears. The fixture lives under `test/` and is excluded from
the published site.
