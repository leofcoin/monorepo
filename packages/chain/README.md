# @leofcoin/chain

> JS based chain

## Flags

- reachedOneZeroZero

## Cold-sync reliability

Both server and browser nodes guard provider discovery against fast negative
responses. A walk succeeds only after a connected peer confirms it provides
the requested hash; individual discovery requests retain the protocol request
timeout.

Chain content requests probe the exact requested store before requesting bytes
from a peer. A pending-only copy cannot act as a provider for the canonical
transaction store. Responses must use the expected codec and advertised hash;
the first valid response wins, and unavailable content fails explicitly.

Incoming chain data requests only read the requested local store. Missing,
private or concurrently removed content receives an empty data response using
the existing codec and request ID; requesters reject it and can try another
provider. A local miss never starts a recursive peer fetch, and read/send
failures are logged without rejecting the transport's detached handler.

Historical ancestry is resolved iteratively, finishing transaction dependencies
before requesting the next parent. Duplicate callers await the same resolution,
completed blocks survive retries, and missing or cyclic ancestry fails explicitly.
Only dependencies of the selected target tip are resolved; unrelated hashes in
a peer's `knownBlocks` inventory do not gate canonical catch-up.
Transaction bodies are hash-checked before entering the canonical transaction
store. Resolving data never applies it: canonical loading still uses the
serialized state writer and chain-link validation.

## Pending transaction propagation

Transactions enter the local pending pool before canonical confirmation. Peers
relay newly accepted transaction bytes using the existing `add-transaction`
topic; duplicate and already-confirmed entries are not relayed again.

On compatible peer reconnection, pending pools are reconciled even at equal
block heights. Missing bodies are fetched from `transactionPool`, checked against
their advertised hash, and admitted through the normal signature-validation and
pending-nonce path. Unavailable or invalid entries are logged without preventing
recovery of the remaining entries.

Pool admission and pubsub publication are not validator acknowledgements.
`sendTransaction().wait` resolves only after canonical block inclusion. Deploy
the updated chain runtime to intermediate nodes and validators as well as the
browser to enable relay and reconnect recovery throughout the network.

<a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/"><img alt="Creative Commons Licence" style="border-width:0" src="https://i.creativecommons.org/l/by-nc/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/">Creative Commons Attribution-NonCommercial 4.0 International License</a>.
