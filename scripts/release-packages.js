import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const command = process.argv[2] ?? 'status'
const flags = new Set(process.argv.slice(3))
const jsonOutput = flags.has('--json')
const dryRun = flags.has('--dry-run')
const forcePublishedAt = process.env.RELEASE_FORCE_PUBLISHED_AT === '1'

const run = (executable, args, options = {}) => {
  const output = execFileSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })
  return typeof output === 'string' ? output.trim() : ''
}

const parseVersion = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version)
  if (!match) throw new Error(`Unsupported semantic version: ${version}`)
  return match.slice(1).map(Number)
}

const compareVersions = (left, right) => {
  const a = parseVersion(left)
  const b = parseVersion(right)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return Math.sign(a[index] - b[index])
  }
  return 0
}

const nextPatch = (version) => {
  const [major, minor, patch] = parseVersion(version)
  return `${major}.${minor}.${patch + 1}`
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const workspaces = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const directory = join(root, 'packages', entry.name)
    const manifestPath = join(directory, 'package.json')
    try {
      return { directory, manifestPath, manifest: readJson(manifestPath) }
    } catch {
      return undefined
    }
  })
  .filter(({ manifest } = {}) => manifest && manifest.name && manifest.private !== true)

const registryMetadata = (name) => {
  try {
    const fields = [
      'version',
      'gitHead',
      'time',
      'type',
      'main',
      'module',
      'exports',
      'types',
      'typings',
      'browser',
      'bin',
      'files',
      'sideEffects',
      'engines',
      'dependencies',
      'optionalDependencies',
      'peerDependencies',
      'peerDependenciesMeta',
    ]
    const output = run('npm', ['view', name, ...fields, '--json'])
    const metadata = JSON.parse(output)
    const version = Array.isArray(metadata.version) ? metadata.version.at(-1) : metadata.version
    return {
      ...metadata,
      version,
      gitHead: Array.isArray(metadata.gitHead) ? metadata.gitHead.at(-1) : metadata.gitHead,
      publishedAt: metadata.time?.[version],
    }
  } catch (error) {
    const stderr = error.stderr?.toString() ?? ''
    if (stderr.includes('E404')) return undefined
    throw new Error(`Unable to read npm metadata for ${name}: ${stderr || error.message}`)
  }
}

const publishedManifestFields = [
  'type',
  'main',
  'module',
  'exports',
  'types',
  'typings',
  'browser',
  'bin',
  'files',
  'sideEffects',
  'engines',
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
]

const packageManifestChanged = (local, published, registryFallback = false) =>
  publishedManifestFields.some((field) => {
    if (registryFallback && published[field] === undefined) return false
    return JSON.stringify(local[field] ?? null) !== JSON.stringify(published[field] ?? null)
  })

const commitExists = (commit) => {
  try {
    run('git', ['cat-file', '-e', `${commit}^{commit}`])
    return true
  } catch {
    return false
  }
}

const packageChangedSince = (workspace, registry) => {
  if (!registry?.gitHead && !registry?.publishedAt) {
    return { changed: true, files: ['<no published git reference>'] }
  }

  const packagePath = relative(root, workspace.directory)
  const hasPublishedCommit =
    !forcePublishedAt && registry.gitHead && commitExists(registry.gitHead)
  const tracked = hasPublishedCommit
    ? run('git', ['diff', '--name-only', `${registry.gitHead}..HEAD`, '--', packagePath])
    : run('git', [
        'log',
        '--name-only',
        '--format=',
        `--since=${registry.publishedAt}`,
        '--',
        packagePath,
      ])
  const working = run('git', ['diff', '--name-only', 'HEAD', '--', packagePath])
  const untracked = run('git', [
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    packagePath,
  ])
  const files = [...new Set([...tracked.split('\n'), ...working.split('\n'), ...untracked.split('\n')])]
    .filter(Boolean)
    .filter((file) => !file.endsWith('/CHANGELOG.md'))

  const manifestFile = `${packagePath}/package.json`
  if (files.includes(manifestFile) && hasPublishedCommit) {
    try {
      const publishedManifest = JSON.parse(
        run('git', ['show', `${registry.gitHead}:${manifestFile}`]),
      )
      if (!packageManifestChanged(workspace.manifest, publishedManifest)) {
        files.splice(files.indexOf(manifestFile), 1)
      }
    } catch {
      // A missing historical manifest is a real package change.
    }
  }
  if (!hasPublishedCommit) {
    const manifestIndex = files.indexOf(manifestFile)
    if (manifestIndex >= 0) files.splice(manifestIndex, 1)
    if (packageManifestChanged(workspace.manifest, registry, true)) files.push(manifestFile)
  }

  return {
    changed: files.length > 0,
    files,
    detection: hasPublishedCommit ? 'gitHead' : 'publishedAt',
  }
}

const inspect = () =>
  workspaces.map((workspace) => {
    const registry = registryMetadata(workspace.manifest.name)
    const change = packageChangedSince(workspace, registry)
    const comparison = registry
      ? compareVersions(workspace.manifest.version, registry.version)
      : 1
    const state = !registry
      ? 'unpublished'
      : comparison > 0
        ? 'pending'
        : change.changed
          ? 'changed'
          : comparison < 0
            ? 'behind'
            : 'current'

    return { workspace, registry, change, comparison, state }
  })

const printable = (items) =>
  items.map(({ workspace, registry, change, state }) => ({
    name: workspace.manifest.name,
    local: workspace.manifest.version,
    published: registry?.version ?? null,
    state,
    changedFiles: change.files,
    detection: change.detection ?? null,
  }))

const print = (items) => {
  if (jsonOutput) {
    console.log(JSON.stringify(printable(items), null, 2))
    return
  }

  console.table(
    printable(items).map(({ name, local, published, state, detection }) => ({
      package: name,
      local,
      published: published ?? '-',
      state,
      detection: detection ?? '-',
    })),
  )
  for (const item of printable(items).filter(({ state }) => state === 'changed')) {
    console.log(`\n${item.name}:`)
    for (const file of item.changedFiles) console.log(`  ${file}`)
  }
}

const prepare = () => {
  const items = inspect()
  const changed = items.filter(({ state }) => state === 'changed' || state === 'unpublished')
  const invalid = items.filter(({ state }) => state === 'behind')

  if (invalid.length) {
    throw new Error(
      `Local versions are behind npm: ${invalid.map(({ workspace }) => workspace.manifest.name).join(', ')}`,
    )
  }
  if (!changed.length) {
    print(items)
    console.log('\nNo package versions need a patch bump.')
    return
  }

  for (const item of changed) {
    const version = item.registry
      ? nextPatch(item.registry.version)
      : item.workspace.manifest.version
    item.workspace.manifest.version = version
    if (!dryRun) {
      writeFileSync(
        item.workspace.manifestPath,
        `${JSON.stringify(item.workspace.manifest, null, 2)}\n`,
      )
    }
  }

  print(items)
  if (dryRun) {
    console.log('\nDry run: no files changed.')
    return
  }

  run('npm', ['install', '--package-lock-only', '--ignore-scripts'], { stdio: 'inherit' })
  console.log(
    `\nPrepared ${changed.length} package patch${changed.length === 1 ? '' : 'es'}. Commit and merge these files before publishing.`,
  )
}

const topologicalPending = (items) => {
  const pending = new Map(
    items
      .filter(({ state }) => state === 'pending' || state === 'unpublished')
      .map((item) => [item.workspace.manifest.name, item]),
  )
  const ordered = []
  const visiting = new Set()

  const visit = (item) => {
    const name = item.workspace.manifest.name
    if (ordered.includes(item)) return
    if (visiting.has(name)) throw new Error(`Circular workspace dependency involving ${name}`)
    visiting.add(name)
    const manifest = item.workspace.manifest
    for (const dependencies of [
      manifest.dependencies,
      manifest.optionalDependencies,
      manifest.peerDependencies,
    ]) {
      for (const dependency of Object.keys(dependencies ?? {})) {
        if (pending.has(dependency)) visit(pending.get(dependency))
      }
    }
    visiting.delete(name)
    ordered.push(item)
  }

  for (const item of pending.values()) visit(item)
  return ordered
}

const publish = () => {
  const items = inspect()
  const pending = topologicalPending(items)
  if (!pending.length) {
    print(items)
    console.log('\nNothing to publish.')
    return
  }

  if (!dryRun) {
    const branch = run('git', ['branch', '--show-current'])
    if (branch !== 'main') throw new Error(`Publishing is only allowed from main, not ${branch}.`)
    const dirty = run('git', ['status', '--porcelain'])
    if (dirty) throw new Error('Publishing requires a clean working tree.')
    run('npm', ['run', 'build'], { stdio: 'inherit' })
    run('npm', ['test'], { stdio: 'inherit' })
  }

  for (const item of pending) {
    const { name, version } = item.workspace.manifest
    console.log(`\nPublishing ${name}@${version}${dryRun ? ' (dry run)' : ''}...`)
    run(
      'npm',
      ['publish', '--workspace', name, '--access', 'public', ...(dryRun ? ['--dry-run'] : [])],
      { stdio: 'inherit' },
    )
  }
}

const trust = () => {
  for (const workspace of workspaces) {
    console.log(`\nConfiguring trusted publishing for ${workspace.manifest.name}...`)
    run(
      'npm',
      [
        'trust',
        'github',
        workspace.manifest.name,
        '--repo',
        'leofcoin/monorepo',
        '--file',
        'release-packages.yml',
        '--yes',
      ],
      { stdio: 'inherit' },
    )
  }
}

try {
  if (command === 'status') print(inspect())
  else if (command === 'prepare') prepare()
  else if (command === 'publish') publish()
  else if (command === 'trust') trust()
  else
    throw new Error(`Unknown command "${command}". Use status, prepare, publish, or trust.`)
} catch (error) {
  console.error(`release-packages: ${error.message}`)
  process.exitCode = 1
}

export { compareVersions, nextPatch }
