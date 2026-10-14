# Peach testnet faucet

The faucet transfers existing test LFC from a dedicated wallet. It cannot mint,
does not run a validator, and refuses any network except `leofcoin:peach`.
Default limits: 10 LFC per claim, one claim per address and IP per 24 hours,
and 1000 LFC per rolling day. Multiple IPs cannot exceed the global budget.

Claims and limits survive restart. Reservations are persisted before broadcast.
Unknown outcomes remain reserved for operator reconciliation and are never
automatically resent. Confirmation comes only from the canonical transaction
completion handle. Do not delete `claims.json` to reset limits.
After a restart, pending claims require operator reconciliation against canonical
chain history; they are not automatically confirmed or rebroadcast.
Only one process may use a faucet directory. An exclusive `faucet.lock` enforces
this; after an unclean shutdown, remove that lock only after verifying the old
process is no longer running. Never share the directory across machines.

## Run locally

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

- `GET /status`: network, readiness, public account and claim amount.
- `POST /claims` with JSON `{ "address": "...", "requestId": "UUID" }`: 202 and a claim ID/hash.
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
`remote.leofcoin.org`, then validate/reload Nginx. It exposes
`https://remote.leofcoin.org/faucet` while the signing service binds only to
loopback. `FAUCET_TRUST_PROXY=1` accepts `X-Real-IP` only from a loopback proxy;
the supplied Nginx config overwrites that header. Do not expose port 8088.

The owner funds the address printed by the remote service. Then verify
`/faucet/status` reports Peach and `ready: true`, request a small claim from a
test wallet, wait for confirmed status and verify the receiving node's balance.
The scheduled public observer workflow keeps checking two additional temporary
nodes. GitHub runners are observers, not permanent validator infrastructure.
