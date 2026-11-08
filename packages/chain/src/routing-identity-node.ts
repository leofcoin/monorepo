import { readFile, mkdir, writeFile, link, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { newRoutingId, validateRoutingId, nodeDataRoot } from './routing-identity.js'

export async function nodeRoutingId(config): Promise<string> {
  if (config.routingId !== undefined) return validateRoutingId(config.routingId)
  // Match @leofcoin/storage's home-relative root resolution exactly. Metadata
  // lives outside all wallet/ledger stores and survives a ledger-only reset.
  const root = join(homedir(), nodeDataRoot(config))
  const file = join(root, 'node-routing-id')
  await mkdir(root, { recursive: true })
  try { return validateRoutingId(await readFile(file, 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const id = newRoutingId()
  const temporary = join(root, `.node-routing-id-${id}.tmp`)
  await writeFile(temporary, id, { flag: 'wx', mode: 0o600 })
  try {
    // Publish a fully written file without replacing a simultaneous winner.
    // Never expose a partially written ID or silently rotate a corrupt one.
    try { await link(temporary, file) }
    catch (error) { if (error.code !== 'EEXIST') throw error }
    return validateRoutingId(await readFile(file, 'utf8'))
  } finally { await unlink(temporary) }
}
