# Publishing changed packages

Package releases use npm's published `gitHead` as their source of truth. This
lets the repository determine which workspace packages changed since their last
actual npm publication.

When an older `gitHead` is no longer reachable after a squash merge, the tool
falls back to npm's immutable publication timestamp and compares the
publish-relevant package manifest fields separately. This also works in a fresh
CI checkout without relying on locally retained git objects.

## Prepare a release

Run:

```sh
npm run release:status
npm run release:prepare
```

`release:prepare` patch-bumps only changed public workspace packages and updates
`package-lock.json`. Review, commit, and merge those changes normally.

Use `npm run release:dry-run` to preview the detected packages and versions
without writing files.

Version-only changes and changelog edits do not cause another bump. Changes to
source, tests, build configuration, or package dependencies do.

## Publish after merge

On a clean `main` branch, run:

```sh
npm run release:publish
```

Publishing refuses to run from another branch or a dirty working tree. It builds
and tests the repository, then publishes local package versions that are newer
than npm. Workspace dependencies are published before their dependants.

Publishing uses npm Trusted Publishing with GitHub Actions OIDC. It does not
use a long-lived npm publish token.

## GitHub Actions

The **Release packages** workflow exposes the same process through
`workflow_dispatch`:

1. Run it with `prepare` to open a pull request containing the detected patch
   bumps.
2. Merge that pull request after CI succeeds.
3. Run it with `publish` to build, test, and publish the merged versions.

Before publishing a package for the first time, configure its npm Trusted
Publisher with:

- Provider: GitHub Actions
- Organization or user: `leofcoin`
- Repository: `monorepo`
- Workflow filename: `release-packages.yml`
- Allowed action: `npm publish`

Every public workspace package must be configured once. The workflow requests
GitHub's `id-token: write` permission, npm exchanges that identity for a
short-lived credential, and npm attaches provenance to public packages
automatically.

With an interactive npm login that owns all workspace packages, configure them
in one pass:

```sh
npm run release:trust
```

This invokes npm's official `npm trust github` command for every public
workspace. It does not publish packages.
