# changelog

## 1.5.68

### Patch Changes

- c24054d: State it
- Updated dependencies [c24054d]
  - @leofcoin/addresses@1.0.18
  - @leofcoin/workers@1.4.13
  - @leofcoin/lib@1.2.38

---

## v1.1.0

- validators produce blocks
- syncs blocks with other nodes
- double contracts throw and are not added (no cost)
- transactions that fail are ignored (no cost and less resource usage)
- native contracts that are internally used by the chain (iow no need for a wrapped token)
- native voting system
- all native contracts are proxied (less hasle when upgrading a contract)
- can add/remove validators
- added stateStore (contracts can be loaded using the state now) (introduces breaking change, devs need to make the state of their contract exposable)
- added snapshotting (recover from state)
