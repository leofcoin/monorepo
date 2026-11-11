# @leofcoin/storage

Shared storage for Node.js (ClassicLevel) and browsers (OPFS).
The source was imported from
[leofcoin/storage at 03821765](https://github.com/leofcoin/storage/tree/03821765c467cdbf6ea1de8e8648bc49b306a2c9)
(3.5.38). Development and releases now live in this monorepo.

```js
import Storage from '@leofcoin/storage'

const store = new Storage('example', '.leofcoin')
await store.init()
await store.put('hello', 'world')
const bytes = await store.get('hello')
```

The existing package name, record encoding and storage locations are unchanged.
Native stores use `root/name` under the home directory by default; pass
`{ homedir: false }` as the third constructor argument for an explicit root.
Browser stores retain their existing origin-private directories named after
the store; the root argument does not relocate browser data.
The storage API passes encoded bytes to its backend, including when browser
bundles load the API and OPFS backend as separate modules.

The main export and `@leofcoin/storage/store` remain available.
`@leofcoin/storage/browser-store` exposes the OPFS backend; the legacy
`@leofcoin/storage/brower-store` spelling aliases it.

## Operation queues

Both backends serialize operations through one queue per store instance.
Individual reads/writes/deletes, `has`, `clear`, and scans use that queue.
Bulk reads and iteration return byte snapshots before a later write or deletion
can invalidate them. Read limits are honored. `has` returns `false` only for a
missing key; storage errors remain visible and retain their original name and
cause, with the store/operation included in the message. Different store
instances remain independent. Calls made through the storage API do not need
additional application-side queues.

The queues do not coordinate direct access through `.db` or independent
instances. In the browser, the webnode's existing single-writer ownership is
still required across tabs. No data reset is needed.

## Development

From the monorepo root:

```sh
npm run build -w @leofcoin/storage
npm run typecheck -w @leofcoin/storage
npm test -w @leofcoin/storage
```

Build storage before its dependents. Native tests use temporary directories;
browser concurrency tests exercise the actual OPFS backend with controlled
file handles, without accessing a user's wallet or ledger.
