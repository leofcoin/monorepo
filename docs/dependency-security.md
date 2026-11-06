# Dependency security maintenance

The November 2026 cleanup addresses the five high-severity Dependabot alerts
across three dependency families. It does not change chain rules or regenerate
genesis.

- Keep Monaco at its existing version while upstream catches up. A scoped root
  override selects DOMPurify 3.4.17 for Monaco's sanitizer. Merely updating the
  editor is not sufficient while its own manifest pins an older sanitizer.
  Monaco also vendors its own sanitizer source: the Monaco Rollup build redirects
  that specific import to the patched npm ESM entry. A generated-module-graph
  assertion rejects builds that omit the patched module or retain the old copy.
  Remove this adapter only after checking the sanitizer shipped by a newer editor.
- Contracts builds use `@rollup/plugin-terser` 1.0.2 and a scoped serializer floor
  of 7.1.4. The Terser core stays at the existing locked version; compare rebuilt
  contract artifacts before changing that version.
- Contracts requires Rollup >=4.66.0 through its declared compatible range. The
  obsolete `packages/contracts/package-lock.json` described an older package,
  including an unused `lucky-numbers` dependency and vulnerable Rollup copies.
  It is removed; install and build this workspace from the repository root.
  Published npm packages remain usable without cloning this monorepo.

Run `npm run test:dependency-security` to check the reviewed version floors and
workspace lockfile policy. CI includes this check. These fixed floors supplement,
but do not replace, Dependabot and `npm audit --audit-level=high`.

Security updates to build tools must not silently replace native-contract
addresses or bundled genesis bytecode. Hash the existing contract artifacts and
genesis manifests, rebuild with the updated dependencies, and compare them.
Do not run the genesis-generation script to make a dependency update pass.

Verification on 2026-11-06: the rebuilt contract JavaScript artifacts and the
public genesis address/bytecode manifests are byte-identical to the pre-update
copies. Monaco remains 0.55.1; the generated editor bundle contains DOMPurify
3.4.17 instead of the vendored 3.2.7. Core tests (333), browser-node tests (73
passed, 12 skipped), and security guards (7) pass, as do the browser builds,
static-asset validation, and isolated transfer/cold-sync/restart test. The
post-update workspace audit reports 0 high and 0 critical vulnerabilities;
9 moderate and 2 low findings remain outside this cleanup.

Upstream advisories:

- [DOMPurify: detached subtree sanitization](https://github.com/cure53/DOMPurify/security/advisories/GHSA-mrv2-3pqr-j5jr)
- [serialize-javascript: code injection](https://github.com/yahoo/serialize-javascript/security/advisories/GHSA-5c6j-r48x-rmvq)
- [Rollup: output path traversal](https://github.com/rollup/rollup/security/advisories/GHSA-mw96-cpmx-2vgc)
