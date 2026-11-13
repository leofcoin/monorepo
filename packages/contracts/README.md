# contracts

## Leofcoin Class

The `Leofcoin` class extends the `Token` class from the `@leofcoin/standards/token.js` module. It represents a specific type of token with predefined properties.

### Constructor

#### `constructor(state: TokenState)`

Creates an instance of the `Leofcoin` class.

##### Parameters

- `state` (TokenState): The initial state of the token.

##### Example

```typescript
import Leofcoin from './native-token'
import { TokenState } from '@leofcoin/standards/token.js'

const initialState: TokenState = {
  // Define the initial state properties here
}

const leofcoin = new Leofcoin(initialState)
```

## Token metadata and restoration

The base `Token` always initializes name, symbol and decimals from its original
constructor parameters, including when restoring a snapshot. These static
values are not added to mutable `TokenState`. Native LFC additionally defines
its fixed metadata directly in its getters: `Leofcoin`, `LFC`, 18 decimals.

## Payment preparation (not activated)

`@leofcoin/contracts/payment-mandates` is a separately deployable prototype.
It is not registered in genesis, bundled into the native protocol bytecodes,
or deployed automatically. Existing LFC balances, block cadence and contracts
are unchanged. Production use requires review and runtime/deployment validation.

### Recurring payment mandates

Deploy `PaymentMandates(lfcTokenAddress)`. A payer then submits two ordinary
L1 transactions:

1. On LFC: `approve(mandatesAddress, aggregateSpendingAllowance)`.
2. On the mandate contract:
   `createMandate(merchant, perPeriodLimit, periodMs, expiresAt, totalLimit)`.

The returned bigint ID identifies immutable terms owned by the transaction
sender. Amounts are token atoms, not decimal LFC values. Creation does not move
or escrow funds. The merchant calls `charge(id, amount)`; funds move directly
from the payer to that merchant through the existing LFC `transferFrom`.
Both the remaining token allowance and the mandate's spending limits must
permit the transfer.

For example, 20 LFC per fixed 30-day interval with a lifetime cap of 240 LFC:

```js
const unit = 10n ** 18n
const periodMs = 30 * 24 * 60 * 60 * 1000
// Parameters for an owner-signed createMandate transaction:
const params = [merchant, 20n * unit, periodMs, expiresAt, 240n * unit]
```

Periods start at the confirmed creation block's execution timestamp.
Time follows the VM's deterministic block time, not the merchant's local clock.
This is a fixed-window cap: unused capacity does not accumulate, and two
successive windows can each be charged near their shared boundary. Thirty days
is not a calendar month. Charges at or after `expiresAt` are rejected.
Backward execution time cannot reopen an older spending window.

Only the owner can `revokeMandate(id)`, and only the named merchant can charge.
Revocation takes effect when committed on L1; it cannot cancel an earlier
committed payment or a charge ordered before the revocation. Changed terms
require a new mandate; revoke the old one to avoid overlapping authorizations.
Token approval is shared across that owner's mandates for this contract, not
an isolated balance per mandate. No keeper, scheduler, wallet UI or automatic
monthly execution is installed.

### Off-chain payment-channel protocol

`@leofcoin/standards` exports `PaymentChannelState`,
`encodePaymentChannelState` and `assertPaymentChannelTransition`. These define
a **unidirectional cumulative-payment prototype**, not a funded channel.

Canonical UTF-8 bytes contain the versioned domain, chain ID, escrow address,
unique funding/channel ID, token, payer, payee, deposit, expiry, challenge period,
sequence and cumulative paid amount. Sign the SHA-256 digest of those bytes
using the payer's wallet; verify with a wallet initialized from the expected
payer address. Bind `chainId` to the canonical genesis hash, not merely a
reusable network name. A funding ID must never be reused after reopening.
Channel expiry is Unix epoch milliseconds; `challengePeriodMs` is a duration
in milliseconds.

```js
import { encodePaymentChannelState, assertPaymentChannelTransition } from '@leofcoin/standards'

assertPaymentChannelTransition(previous, next)
const bytes = encodePaymentChannelState(next)
const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
const signature = await payerWallet.sign(digest)
// verifier must be initialized from the trusted expected payer address.
const valid = await verifier.verify(signature, digest)
```

Terms cannot change, sequence numbers must increase, cumulative payments cannot
decrease, and claims cannot exceed the declared deposit. Monetary values and
sequence numbers are bounded unsigned 256-bit integers. These checks are
neither signature verification nor proof that the declared deposit exists.
Applications must also check trusted funding terms, expiry and the signature,
and durably retain the newest accepted state.

**No channel funding or settlement API is enabled.** The current VM does not
verify these off-chain signatures. Before accepting any channel funds, implement
and validate deterministic signature verification, actual escrow funding,
replay-safe lifecycle IDs, unilateral exits, challenge deadlines, stale-state
disputes, withdrawal accounting and monitoring/watchtower recovery. Arbitrary
game state and a general-purpose L2 are outside this prototype.

Preparation checks cover nine focused mandate/channel cases, strict typing of
the new modules and their public import paths, and signing/verification with
the existing wallet. These are not an audit or a funded-channel runtime test.
