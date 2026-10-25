import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateGenesisBundle } from '../dist/genesis.js'

export async function extractGenesis(input, output) {
  const raw = await readFile(input)
  if (raw.length > 4 * 1024 * 1024) throw new Error('Genesis bundle exceeds 4 MiB')
  const bundle = JSON.parse(raw.toString('utf8'))
  if (bundle.schema !== 'leofcoin:genesis-bundle:v1') throw new Error('Unsupported genesis bundle schema')
  const verified = await generateGenesisBundle(bundle.plan)
  for (const field of ['fingerprint', 'identity', 'addresses', 'bytecodes']) {
    if (JSON.stringify(bundle[field]) !== JSON.stringify(verified[field]))
      throw new Error(`Genesis bundle ${field} differs from its verified plan`)
  }
  // Refuse an existing directory, including any live runtime or source tree.
  await mkdir(output, { mode: 0o700 })
  await Promise.all([
    ['addresses.json', verified.addresses], ['bytecodes.json', verified.bytecodes],
    ['chain-identity.json', verified.identity], ['genesis-plan.json', verified.plan]
  ].map(([name, value]) => writeFile(join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o644 })))
  return verified.identity.chainId
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output, ...extra] = process.argv.slice(2)
  if (!input || !output || extra.length) {
    console.error('Usage: npm run genesis:extract -w @leofcoin/chain-manager -- bundle.json NEW_OUTPUT_DIRECTORY')
    process.exitCode = 1
  } else {
    try {
      const chainId = await extractGenesis(resolve(input), resolve(output))
      console.log(`Verified genesis artifacts extracted to ${resolve(output)}\nChain ID: ${chainId}\nNo running chain, identity or store was changed.`)
    } catch (error) {
      console.error('Genesis extraction failed:', error instanceof Error ? error.message : error)
      process.exitCode = 1
    }
  }
}
