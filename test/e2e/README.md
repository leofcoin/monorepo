# End-to-end tests

Run the local four-process bootstrap and restart gate with:

```sh
npm run test:e2e
```

In GitHub Codespaces or VS Code, this is also available from **Tasks: Run Test Task** as **Leofcoin: Four-node E2E**. The repository's dev container pins Node 22 and installs dependencies during Codespace creation.

This creates isolated temporary homes, starts a local discovery star plus four real node and chain processes, verifies full peer discovery and the empty bootstrap state, restarts one process, verifies identity persistence and reconnection, and always removes the temporary data.

This is a lifecycle, storage-isolation, and peer-connectivity gate. It does not yet prove block production or consensus convergence.

## Remote lifecycle smoke test

Copy `remote-nodes.example.json` outside the repository, configure SSH host aliases and systemd user-service names, then run:

```sh
LEOFCOIN_REMOTE_CONFIG=/secure/path/remote-nodes.json npm run test:e2e:remote -- smoke
```

Supported actions are `start`, `stop`, `restart`, `status`, and `smoke`. Smoke mode verifies all configured nodes, restarts the first validator, waits for its service and optional health command, then verifies every node again.

SSH must be non-interactive. CI should provide the private key and known-host entries through secrets. Do not commit credentials or production host details.
