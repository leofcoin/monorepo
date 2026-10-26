# Browser node and wallet

## Chain manager

Chain manager is a separate [web and Electron app](../chain-manager/README.md).
It is no longer bundled with the browser node or available at `#!/manager`.
Old links show a notification and return to the wallet.

The browser uses a bundled, exact chain-ID-to-name mapping for display; unknown
IDs remain unlisted rather than receiving a guessed name. The Peach testnet
mapping is part of the published app and changes only with a software release.
It is a local display label, not an on-chain registration or proof that a live
network is official. The chain ID is not displayed in the navigation drawer.

Runtime nodes still expose public chain identity through the `chainIdentity`
peer request and the read-only HTTP `/chainIdentity` endpoint. The standalone
manager can check an explicitly configured HTTP endpoint without unlocking this
wallet or starting a browser node.

## Wallet

Use the **Network** selector in the header to switch between Leofcoin Mainnet
and Peach testnet. Switching confirms and reloads the browser node. The wallet
key is shared between networks; chain, account-marker, and transaction-history
stores are isolated per network. The browser keeps the selected network locally.
Mainnet is currently marked experimental; verify its chain ID and connection
before sending funds.

The browser runs its own selected-network node and stores its encrypted identity locally.
Wallet, Identity, Chat, Validator, Faucet and Explorer automatically open the existing
create/import/unlock dialog when no wallet is loaded, without an intermediate
card. After unlocking, the original route, including its subview, is restored.
Public views do not force a login on every app load.
Sending is enabled only after chain sync and a peer connection. Review shows
the recipient, amount, signed transaction fee and total. Acceptance by the local
node is shown as pending; only canonical completion shows confirmed.

The bottom status bar spans the full window width, including below the desktop
drawer, and shows node sync progress, connected peers and the latest local block
across all views. Click its sync status to open the sync details.

### Node activity

Open **Node activity** in the drawer (`#!/stats`) for sync progress, local and
target block heights, connected peer IDs, and a filterable live network log.
It is separate from the wallet's transaction Activity screen.

The browser observes P2P protocol handlers, P2P sends and peer requests, page
`fetch` calls, and messages on WebSockets created after the shell starts.
This is an application event log, not a complete packet capture: worker-internal
traffic, browser asset loading and incoming traffic on already-open sockets
are not covered. Requests and responses are separate events; measured sizes
exclude unknown HTTP bodies and transport overhead.

Only the latest 300 events are retained in memory. Counters include older
events until **Clear activity** or a page reload. **Pause live view** freezes
the display, not capture. Payloads, HTTP paths, query strings, credentials and
wallet secrets are not retained; endpoint URLs are reduced to their origins.

### Identity and Validator

Identity's Overview, Accounts, Account details and Backup screens share
illustrated headers, responsive cards and subtle entrance/hover effects.
Expand an account to view and copy its external and internal public addresses.
Backup opens the existing password-protected export flow, with progress and
visible errors; backup contents are not logged. The unused mnemonic button
has been removed rather than implying recovery information can be displayed.

Validator shows the contract's registered address list, a searchable overview
and the selected account's registration status. Registration is not an online
or reward indicator. Refresh reads the local-chain registry; opening the screen
does not automatically enable participation. Participation requires an explicit
confirmation because it can submit registration/approval transactions and lock
stake. Registration submission and enabled local participation are shown as
different outcomes. All refreshed screens respect `prefers-reduced-motion`.

### Explorer rankings

The Explorer dashboard shows the top five LFC holders by current local-chain
balance (including contract addresses), most used contracts by top-level method
calls, and most active senders by transaction count. Holder shares use the sum
of current balances, not a separately estimated total supply.

Activity rankings reuse the dashboard's latest block sample, up to 128 blocks,
and display the actual sample size and index range. They include native-token
calls but exclude internal contract calls and off-chain/read-only requests.
These are activity metrics, not endorsements, unique-user counts or all-time
rankings. During sync, results reflect only the currently available local state.

Open **Address book** in the navigation drawer (`#!/address-book`) to add,
rename or remove named wallet addresses, including your own. Contacts are saved
locally on this device and isolated per network. In **Wallet > Pay**, use
the **Choose from address book** icon button inside the right side of the recipient field to search and select
a saved contact in a dialog. Selecting a contact fills only the recipient;
the amount and the normal review/confirmation flow remain unchanged.

### Peernet chat

Open **Chat** (`#!/chat`) with an unlocked wallet and a running Peernet node.
Use **Add friend** to save a friend's Peernet ID, or copy your own ID to share.
Their device appears when they open Chat on the same Peernet network; select
their entry to start a direct message. Joined Spaces appear in the left rail.
Direct messages are encrypted to a discovered device certificate. Each browser
device has a separate random device ID and non-exportable keys in IndexedDB;
the wallet signs its certificate. A newly announced device for the same wallet
must be approved from an already trusted device before it can participate in
that wallet's conversations.

Known device certificates are stored locally per network so an encrypted DM
can be addressed while its recipient is offline. Nodes may separately opt in
to **Offer encrypted DM archiving**. Archive nodes retain ciphertext only,
with a 30-day maximum retention and bounded local capacity. A verified signed
delivery receipt triggers best-effort deletion from reachable archives and
the sender's outbox; it cannot erase copies held by unreachable or untrusted
nodes. This uses Peernet's archive mode and message store. Decrypted chat
history is saved locally on the current browser device, encrypted with that
device's non-exportable chat key, and limited to the latest 2,000 messages.
History is not synchronized to another device; signing into the same wallet
does not transfer device keys or past messages.

Spaces use a shared AES-GCM key, with invitations delivered inside encrypted
DMs and messages gossiped through Peernet. Space keys are locally wrapped
using the device's non-exportable encryption key. Space messages are currently
live gossip only: they are not archived or replayed to offline members. The
current version has no member-removal/key-rotation workflow; create a new
Space and invite the intended devices after membership changes.

The browser node uses the wallet's Peernet ID on every device. Signing in with
the same wallet therefore keeps the same network identity when moving between
devices; only one device for a wallet should be connected at a time because
simultaneous nodes with the same Peernet ID may conflict. Chat encryption keys
remain local to each device and are not transferred with the wallet.

### Explorer block details

Select a block in Explorer to see its zero-based block index, timestamp,
transaction and validator counts, fees and reward. The size is the encoded
block message size, not its JSON representation or transport overhead.
Compact LFC amounts retain the exact value in their tooltip.
Hashes, the producer and validator addresses can be copied; the previous-block
link follows the recorded parent hash. Transactions are listed inline with
sender, destination/contract and method. Empty blocks and failed reads have
explicit states, and failed reads can be retried.

To test locally:

```sh
npm ci
npm run build
npm run build -w @leofcoin/node
npm run serve -w @leofcoin/node
```

Open `http://localhost:9555`. Create a wallet, save the mnemonic/password or
export an encrypted backup from Identity, and copy the Receive address. A
testnet operator can fund that address with test LFC. On Peach, open
**Testnet faucet** in the drawer (`#!/faucet`) to request test tokens for the
selected wallet account when the faucet service is available. The faucet has
its own view; it is not embedded in the drawer. The navigation entry is hidden
on mainnet and direct mainnet faucet links return to Wallet without contacting
the faucet. Test LFC has no monetary value.

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
