# Publishing changed packages

Package releases use npm's published `gitHead` as their source of truth. This
lets the repository determine which workspace packages changed since their last
actual npm publication.

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

An npm login or an `NPM_TOKEN` with publish access is required.

## GitHub Actions

The **Release packages** workflow exposes the same process through
`workflow_dispatch`:

1. Run it with `prepare` to open a pull request containing the detected patch
   bumps.
2. Merge that pull request after CI succeeds.
3. Run it with `publish` to build, test, and publish the merged versions.

Add an npm automation token as the repository secret `NPM_TOKEN` before using
the publish action.
