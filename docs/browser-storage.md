# Browser settings and local storage

Open **Settings** in the browser node navigation. It is available without unlocking
a wallet. Storage usage/quota is an approximate origin-wide browser estimate;
record counts are scoped to the selected network and bounded at 10,000 per store.
Settings does not read wallet values to display those counts.

- **Remove local blocks** clears `block`, `chain`, `state`, `transaction`,
  `transactionPool`, `contract` and `accounts` for the selected network. Blocks
  cannot safely be cleared independently from canonical pointers/checkpoints.
  Matching network beacon shares are removed; shared identity, other wallet data,
  contacts, chat and other networks are preserved.
- **Clear pending pool** clears only that network's `transactionPool`. This is not
  an on-chain cancellation: an already-broadcast transaction may still finalize.

Neither action creates a backup, changes genesis, nor erases network history.
Resynchronization after a local-chain reset needs compatible peers. Both actions
require typing a confirmation phrase and reload the document before doing any
clearing, so this tab's workers and in-memory nonce/waiter state cannot keep using
the old data.

Updated browser nodes hold a shared Web Lock during wallet/node use. Maintenance
requires an exclusive origin-wide lock; close other Leofcoin tabs first. If Web
Locks are unavailable the app refuses unsafe maintenance/startup rather than
silently bypassing locking. Older application versions do not participate in this
lock protocol: close those tabs as well before using the controls.

An origin-wide local-storage journal is written before clearing begins. Partial
failure/crash leaves the journal intact, blocks node startup and is retried on
reload, including from another tab if the initiating tab was closed. Every store
clear settles before the lock is released. Protected wallet bytes are compared
before/after; wallet keys for other networks are never bulk-cleared.

Tests use in-memory stores/locks and separate temporary Chrome profiles. The
browser test exercises real OPFS clearing across a document reload, typed-confirmation
and cancellation, and verifies that wallet and other-network records survive.
