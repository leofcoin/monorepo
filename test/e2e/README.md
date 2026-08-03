# End-to-end tests

Run the local four-process bootstrap and restart gate with:

```sh
npm run test:e2e
```

In GitHub Codespaces or VS Code, this is also available from **Tasks: Run Test Task** as **Leofcoin: Multi-node E2E**. The repository's dev container pins Node 22 and installs dependencies during Codespace creation.

This creates isolated temporary homes and a local discovery star. It verifies the existing four-node bootstrap/restart lifecycle and a two-node chain-sync flow where a late node discovers a source node, requests `lastBlock` and `knownBlocks` through the real transport, fetches two canonical fixture blocks, converges on the same persisted state snapshot, and retains that state after restart. Temporary data is always removed.

This is a lifecycle, storage-isolation, peer-connectivity, wire-format, cold-sync, and restart-recovery gate. Fixture blocks are signed and hash-linked but inserted by the harness, so this test does not claim to prove validator election, quorum, or live consensus block production.

## Remote lifecycle smoke test

Copy `remote-nodes.example.json` outside the repository, configure SSH host aliases and systemd user-service names, then run:

```sh
LEOFCOIN_REMOTE_CONFIG=/secure/path/remote-nodes.json npm run test:e2e:remote -- smoke
```

Supported actions are `start`, `stop`, `restart`, `status`, and `smoke`. Smoke mode verifies all configured nodes, restarts the first validator, waits for its service and optional health command, then verifies every node again.

SSH must be non-interactive. CI should provide the private key and known-host entries through secrets. Do not commit credentials or production host details.
