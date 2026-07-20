# End-to-end tests

Run the local four-process bootstrap and restart gate with:

```sh
npm run test:e2e
```

This creates isolated temporary homes, starts four real node and chain processes, verifies that their identities are distinct, checks that they converge on the same empty bootstrap state, restarts one process, verifies identity persistence, and always removes the temporary data.

It does not claim peer-to-peer consensus coverage because the repository currently has no local discovery/star-server fixture.

## Remote lifecycle smoke test

Copy `remote-nodes.example.json` outside the repository, configure SSH host aliases and systemd user-service names, then run:

```sh
LEOFCOIN_REMOTE_CONFIG=/secure/path/remote-nodes.json npm run test:e2e:remote -- smoke
```

Supported actions are `start`, `stop`, `restart`, `status`, and `smoke`. Smoke mode verifies all configured nodes, restarts the first validator, waits for its service and optional health command, then verifies every node again.

SSH must be non-interactive. CI should provide the private key and known-host entries through secrets. Do not commit credentials or production host details.
