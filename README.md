# monorepo

## Workspace builds

After `npm ci`, use Rage 1.2+ to build the declared npm workspaces in dependency
order. Packages without a build script, such as the JavaScript faucet, are
skipped; real build failures still fail the command.

```sh
npm run build-all                 # Full workspace build, including browser node
npm run build:workspaces          # Incremental build using successful-build cache
npm run build:workspaces -- --dry-run --jobs 2
```

Dependency, lockfile and shared build-config changes invalidate the affected
cache. Use `--jobs` to bound parallel builds. `npm run build` / `build:core`
remain available for the existing core-only build used during releases.
Building packages does not start a node or change genesis, identities or chain data.

## Local validator

After building the workspace and creating genesis credentials, run the local `peach` validator with:

```sh
npm run validator
```

It loads `genesis-credentials/leofcoin-peach/genesis-password.txt`, activates validator participation, and submits one minimal self-transfer every five minutes. Override the credential path or interval with `LEOFCOIN_PASSWORD_FILE` and `LEOFCOIN_TRANSACTION_INTERVAL_MINUTES`. Never commit either the password or identity backup.
