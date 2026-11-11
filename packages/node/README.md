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
Wallet, Identity, Chat, Validator and Faucet automatically open the existing
create/import/unlock dialog when no wallet is loaded, without an intermediate
card. After unlocking, the original route, including its subview, is restored.
Public views do not force a login on every app load.

### Optional passkey unlock

Open **Settings → Passkey unlock**, enter the current wallet password and select
**Enable passkey unlock**. Follow the device prompt to create a credential, then
select **Verify passkey** and approve the second prompt to finish setup. This
explicit second action lets browsers that require a fresh user gesture perform
the verification. Setup verifies an assertion with PRF before storing anything;
creating a credential alone does not enable wallet unlock. On subsequent
unlocks choose **Unlock with passkey**, or continue using the password field.
Face ID, Touch ID, fingerprint, a security key or a device PIN may be offered by
the operating system. The app requires user verification but cannot force a
particular biometric method. Unsupported PRF credentials fail closed, leaving
password access unchanged. Enrollment may leave a credential in the password
manager even when PRF verification fails; no unlock envelope is saved then.

The passkey's WebAuthn PRF output derives a non-extractable AES-256-GCM wrapping
key through HKDF-SHA-256. Only a versioned encrypted copy of the **existing wallet
password**, a random salt/IV and public credential/binding metadata are saved in
the local wallet store. Neither the password, PRF output nor wrapping key is
persisted in plaintext, sent to a server, or broadcast to follower tabs. The
envelope is bound to the exact origin, RP, encrypted wallet identity and
credential. Unlock still goes through the existing wallet decryption and node
startup path; it does not generate accounts, change genesis, or confirm a payment.

Keep your **wallet password and encrypted backup**. The local envelope is not a
wallet backup: clearing site data, switching sites or losing the credential may
require password-based recovery. Credential syncing depends on the passkey
provider; it does not sync this local envelope. Removing passkey unlock removes
only that envelope, not the wallet or the credential in the device's password
manager. Clearing local blocks or the pending pool does not clear it.

WebAuthn needs a secure context and a domain (HTTPS, or `http://localhost` for
development). Loopback IP URLs such as `http://127.0.0.1` are not valid passkey
RP domains; use the same localhost URL consistently for setup and unlock. This is
local cryptographic unlock, not remote account authentication. A compromised
page/extension or already-unlocked session can still access secrets in memory;
biometrics do not replace origin security or make wallet code immune to XSS.

Sending is enabled only after chain sync and a peer connection. Review shows
the recipient, amount, signed transaction fee and total. Acceptance by the local
node is shown as pending; only canonical completion shows confirmed.

The bottom status bar spans the full window width, including below the desktop
drawer, and shows node sync progress, connected peers and the latest local block
across all views. Click its sync status to open the sync details.

The navigation drawer groups wallet, network and community tools. On desktop
it stays visible; on narrow screens it opens from the menu button, keeps keyboard
focus inside, and closes with Escape or the backdrop. Its network card opens the
same sync drawer as the bottom status bar.

Sync and notifications use matching, scrollable side drawers with native modal
focus handling. A connected peer only counts as compatible after its protocol
major/minor version matches the local chain. Sync readiness also requires the
chain to report synced and a known local tip. Unknown heights show **—**; block
zero remains valid. A progress bar appears only for a known observed target.
Local sync is not transaction finality.

Notifications include timestamps and an errors filter. Up to 100 are retained
in memory for this tab, with at most three simultaneous toasts. Toasts pause on
hover or keyboard focus. Opening the inbox marks its entries read. Clearing or
dismissing a notification does not cancel or change a transaction.

For an isolated UI preview, build the node and run `npm run test:ui` from this
package, then open `http://127.0.0.1:9556/console?view=stats`. Add
`&panel=notifications` to preview the inbox with sample messages. This fixture
uses simulated state and does not start a node, unlock a wallet or send transactions.

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

### Settings and local data

Open **Settings** in the drawer (`#!/settings`) to inspect browser storage and
manage local chain data. **Remove local blocks** clears this browser's selected
network ledger while preserving the wallet, identity and other networks. The
page reloads first and requires a typed confirmation; close other node tabs
before continuing. See [browser storage management](../../docs/browser-storage.md)
for details on locking, recovery and the stores affected.

The workspace [storage library](../storage/README.md) queues bulk reads (`keys`,
`values`, `entries`, `size`) alongside individual reads, writes and deletes.
Different stores remain independent. This prevents OPFS file snapshots from
becoming unreadable during concurrent writes or deletes, without a webnode
adapter. Failed reads report the store and operation; no ledger data is discarded
or reset.

### Identity and Validator

Wallet creation keeps the recovery phrase, wallet password and final confirmation
in the dialog's normal layout. On short screens the dialog scrolls; both backup
dialogs must be confirmed before **I Understand** becomes available.

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

### Explorer navigation and ledger

Explorer does **not** require wallet login. **Settings → Explorer node
preference** controls its read-only data source. The default, **Try local node
first**, probes `http://localhost:8080` (launch-chain's default HTTP endpoint),
then uses the browser-owned chain if running, then Peach's configured public
HTTP source. **Prefer browser node** skips the local endpoint probe. A local
node must serve the selected network; a different network is rejected rather
than silently replaced. The login screen shows a detected node's network,
chain ID, sync state, tip and peer count so the data-source preference can be
chosen there too. An HTTPS-hosted app may be prevented by browser policy from
accessing local HTTP; use a browser-supported local/secure endpoint in that
case.

This preference does not change wallet signing or browser-node startup: after
unlock, the browser-owned node still handles wallet actions. Explorer reads
never assign a remote endpoint to the global signer, chain, client or peer
state, open wallet/account stores, or publish `node:ready`. Sending and
validator actions still require the real local wallet.
The initial create/unlock screen also offers **Browse explorer without
unlocking**; this is not shown during required wallet-backup acknowledgements.

Peach's public endpoint is `https://remote.leofcoin.org`, pinned to the bundled
Peach genesis chain ID. Each response must match that ID, and the initial genesis
identity is verified. Public data is labelled as endpoint-reported, not locally
verified consensus. There is no configured public Mainnet endpoint yet; its
explorer reports that explicitly rather than requesting wallet login or silently
showing Peach data.

The remote server must run the matching updated `@leofcoin/endpoints` build with
the `/explorer/*` API. Until that release is deployed, the UI shows an endpoint
update/retry error, without opening a wallet. No legacy account-management or
transaction-submission endpoint is used.

The explorer has labelled **Overview**, **Blocks**, **Transactions** and
**Pending pool** tabs. One search field automatically recognizes an exact
zero-based block index (including genesis at 0), a block hash or a transaction
hash by decoding its codec header and checking the full hash. Decimal indices
are parsed as BigInt (with an optional `n` suffix); values outside the current
node API's safe-number index range are reported explicitly, never rounded.
The selected data source supplies block-index lookups; the explorer does not guess a height from
the position of an item in a recent-block array.

Block pages contain up to 25 blocks. Transaction pages resolve up to 25 bodies
at a time, with four concurrent reads, and retain the correct containing block
hash/index. Next/previous controls browse within the selected block range and
then move to older/newer ranges. Page filters are explicitly local to the
displayed page. New activity prompts a refresh instead of shifting the list
under the cursor. Missing block or transaction data is reported rather than
silently counted as zero.

The pending-pool tab reads the local pool store only, capped at 100 entries.
These are not confirmed transactions or a network-wide pool. Content hashes
are checked in block/transaction detail views. A transaction is labelled
**Recorded in local chain** only after checking its reference in the supplied
local block; finding its body in storage alone does not establish inclusion.
No explorer label is an independent proof of network finality.

Native amounts use the current two-argument `transfer(to, amount)` interface
and exact 18-decimal integer formatting. Other token decimals are not guessed.
Tiny nonzero values display as **<0.000001** in compact tables, with exact values
in detail views/tooltips. Transaction fee-paid values are not invented from
the current fee calculator; block detail shows the recorded block fee total.

Use the isolated `/console?view=explorer` fixture to review the screens without
starting a node or submitting transactions.
Add `&anonymous=1` to exercise the real HTTP adapter and endpoint middleware
against simulated public data while leaving the wallet locked. The fixture
remaps the public origin to its local test server only; this is not live network
verification.

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
If the sample only contains unresolved transaction hashes, activity rankings are
explicitly unavailable rather than presenting zero activity. Registry membership
does not establish online validator status, and a block transaction count is not
a measured TPS rate; unavailable liveness/throughput data is labelled as such.

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

Transport routing IDs are separate from the wallet identity. Each installation
has its own saved routing ID, so a browser and native validator can use the same
wallet without colliding at discovery. Browser IDs are scoped by network and
account, not randomized per tab. Chat encryption keys remain local to each
device and are not transferred with the wallet.

### Main browser tab and following tabs

After unlocking, one tab per browser profile/origin and network becomes the main
tab. It alone runs the chain workers, writes the shared chain stores and opens
P2P connections. Other unlocked tabs follow its chain status, tip and peers and
read public data through bounded binary `Uint8Array` BroadcastChannel messages.
The header identifies the main/following role. Account selection and signing
remain local to each tab: only already-signed payments can be forwarded, and
admission is not reported as confirmation. Validator activation and contract
deployment must be performed in the main tab, not by remotely invoking its
signer. No password, secret key or wallet export is shared.

Closing the main tab releases its exclusive Web Lock and lets an unlocked
follower reopen the existing stores as the new main tab. The same account keeps
the same routing ID; a different selected account has its own saved ID. All
accounts' tabs share one chain-state writer per network, rather than running
competing state machines over the same stores. A stalled/paused main tab is
shown as unavailable; a heartbeat timeout never bypasses its writer lock.
Requests are not automatically replayed during handoff. If a payment's outcome
is unknown after the main tab disappears, check canonical history before retrying.
Reload all older app tabs when upgrading to this main-tab architecture.

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

### Browser resource overview

Open **Settings** in the drawer (`#!/settings`), also available while locked.
The storage overview separates the whole site's estimated usage/quota from the
selected network's store file sizes. Sizes use OPFS metadata only, never record
contents, with a limit of 10,000 entries per store. A `≥` marks an incomplete
scan; this live sample excludes filesystem overhead and may change while the
node writes. Refresh updates it; there is no background polling.

**Measure memory** requests an application-memory estimate only when
`performance.measureUserAgentSpecificMemory()` and cross-origin isolation are
available. Unsupported or failed measurements remain explicitly unavailable,
not zero. A measurement can take up to 30 seconds; retrying a timed-out sample
reuses the pending request. Hosting security headers are not changed by Settings.
The processor count is the browser's logical-concurrency hint, not CPU load.
Neither figure represents total system RAM usage or all browser processes.
