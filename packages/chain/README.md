# @leofcoin/chain

> JS based chain

## Flags

- reachedOneZeroZero

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
