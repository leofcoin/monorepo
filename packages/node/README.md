# Browser node and wallet

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
