import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

export async function currentFingerprint(root) {
  const hash = createHash('sha256')
  let files = 0
  const add = async path => {
    hash.update(relative(root, path))
    hash.update('\0')
    hash.update(await readFile(path))
    hash.update('\0')
    files++
  }
  const walk = async path => {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) await walk(join(path, entry.name))
      else if (entry.isFile()) await add(join(path, entry.name))
    }
  }
  for (const name of ['binary', 'chain', 'messages', 'workers', 'lib', 'addresses', 'codecs', 'contracts', 'standards', 'utils']) {
    await add(join(root, 'packages', name, 'package.json'))
    for (const directory of ['src', 'exports']) {
      try { await walk(join(root, 'packages', name, directory)) }
      catch (error) { if (error.code !== 'ENOENT') throw error }
    }
  }
  await add(join(root, 'package-lock.json'))
  return { sha256: hash.digest('hex'), files }
}
