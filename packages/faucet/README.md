# Peach testnet faucet

The faucet transfers existing test LFC from a dedicated wallet. It cannot mint,
does not run a validator, and refuses any network except `leofcoin:peach`.
Default limits: 10 LFC per claim, one claim per address and IP per 24 hours,
and 1000 LFC per rolling day. Multiple IPs cannot exceed the global budget.

Claims and limits survive restart. Reservations are persisted before broadcast.
Unknown outcomes remain reserved for operator reconciliation and are never
automatically resent. Pending claims with a transaction hash are automatically
reconciled against canonical blocks after restart, in bounded batches once the
node is synced and connected. Absence from the chain does not prove failure.
Reservations without a hash still require operator reconciliation. Do not
delete `claims.json` to reset limits.
An execution rejection can be speculative, so it remains pending rather than
freeing its reservation until an operator establishes its outcome.
Only one process may use a faucet directory. An exclusive `faucet.lock` enforces
this; after an unclean shutdown, remove that lock only after verifying the old
process is no longer running. Never share the directory across machines.

## Run locally

After the package and its updated runtime dependencies are published to npm,
no monorepo checkout is needed:

```sh
FAUCET_DATA_DIR=/absolute/private/faucet-directory npx --yes --package @leofcoin/faucet leofcoin-faucet
```

This starts a persistent signing service, not a validator. Its data directory
must remain private and outside the package installation directory. For a
production service, install and pin a reviewed package version rather than
downloading a changing version at every boot. Deployment templates are included
in the package's `deploy` directory.

Requires Node >=24.15.0. From the monorepo root:

```sh
npm ci
npm run build
FAUCET_DATA_DIR=/absolute/private/faucet-directory npm start -w @leofcoin/faucet
```

The service generates a new password file (mode 600) only if none exists and
keeps its identity/state in this separate directory. Back up the complete
directory securely. Startup prints the public faucet address and password-file
path, not its password or private key. Fund the public address from the existing
Peach genesis owner. Never use the genesis owner's identity as the faucet.
Wallet v4 changes mnemonic and child-key derivation: before upgrading an
existing v3 faucet, back up its identity and verify that the restored address
matches the recorded account. The faucet refuses startup if its account changes.

The genesis validator remains on the owner's local node. With the existing
genesis identity already installed there, start it using:

```sh
LEOFCOIN_PASSWORD_FILE=/absolute/path/genesis-credentials/leofcoin-peach/genesis-password.txt npm run validator
```

In its interactive shell, fund the faucet (replace ADDRESS):

```text
transfer ADDRESS 1000
```

Wait for canonical confirmation. Keep at least one eligible validator online;
additional validators join using the existing launcher and funded accounts.
Do not regenerate genesis to fund the faucet.

## API

Paths may also be prefixed with `/faucet`. Requests and responses use the
`@leofcoin/binary` RPC codec and `application/octet-stream`, not JSON.

- `GET /status`: network, readiness, public account and claim amount.
- `POST /claims` with encoded `{ address, requestId }`: 202 and a claim ID/hash.
  Generate and retain the UUID before sending. Repeating the same request ID
  returns its original receipt without another payment. A lost HTTP response
  is not proof of failure: query its receipt or retry with the same UUID.
- `GET /claims/ID`: reserved, pending, confirmed or failed. Public responses
  never contain IP addresses or identity material.

Use `npm test -w @leofcoin/faucet` for durable reservation, concurrency,
rate/budget, restart and HTTP tests.

## Remote installation

Install the reviewed repository at `/opt/leofcoin-monorepo` and use a system
Node runtime >=24.15.0. Build dependencies before starting the service. Copy
`deploy/faucet.env.example` to `/etc/leofcoin-faucet.env` and
`deploy/leofcoin-faucet.service` to `/etc/systemd/system/`. Set `ExecStart` to
the actual absolute Node binary if it differs from `/usr/bin/node`.

```sh
useradd --system --user-group --home-dir /var/lib/leofcoin-faucet --shell /usr/sbin/nologin leofcoin-faucet
systemctl daemon-reload
systemctl enable --now leofcoin-faucet
journalctl -u leofcoin-faucet -f
```

Add `deploy/nginx-location.conf` inside the existing HTTPS server for
`remote.leofcoin.org`, then validate/reload Nginx (`nginx -t`). It exposes
`https://remote.leofcoin.org/faucet` while the signing service binds only to
loopback. Its `^~` prefix keeps regex locations and the node API catch-all from
taking `/faucet/`. If Cloudflare (e.g. a tunnel) routes the hostname directly to
the node API instead of Nginx, add a `/faucet` route to `127.0.0.1:8088` ahead
of the catch-all; the faucet accepts paths with or without the `/faucet` prefix.
Prefer routing through Nginx so it overwrites `X-Real-IP`. If another proxy is
used with `FAUCET_TRUST_PROXY=1`, it must similarly overwrite that header with a
verified client IP; never trust a client-supplied header. Without a trusted
client IP, disable proxy trust, though all proxied users will share one IP limit.
When Nginx is behind Cloudflare, configure its real-IP handling to trust only
Cloudflare's published proxy ranges before treating `$remote_addr` as the client.
Every faucet response carries `X-Leofcoin-Service: faucet`. A response without
it (for example HTTP 200 `{ error: 'Not Found' }` with
`Access-Control-Allow-Origin: *`) comes from the node API, meaning `/faucet` is
not routed to the faucet. `FAUCET_TRUST_PROXY=1` accepts `X-Real-IP` only from a loopback proxy;
the supplied Nginx config overwrites that header. Do not expose port 8088.

The owner funds the address printed by the remote service. Then verify
`/faucet/status` reports Peach and `ready: true`, request a small claim from a
test wallet, wait for confirmed status and verify the receiving node's balance.
The scheduled public observer workflow keeps checking two additional temporary
nodes. GitHub runners are observers, not permanent validator infrastructure.
