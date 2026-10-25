import { readFile, stat } from 'node:fs/promises'
import { GENESIS_PLAN_MAX_BYTES, parseGenesisPlan, validateGenesisPlan, fingerprintGenesisPlan } from '@leofcoin/lib/genesis-plan'

try {
  const args = process.argv.slice(2)
  if (args.length !== 1 || args[0].startsWith('-')) throw new Error('Usage: node scripts/validate-genesis-plan.js <plan.json>')
  if ((await stat(args[0])).size > GENESIS_PLAN_MAX_BYTES) throw new Error('Genesis plan exceeds the 1 MiB size limit')
  const plan = await validateGenesisPlan(parseGenesisPlan(await readFile(args[0], 'utf8')))
  console.log(JSON.stringify({
    valid: true, chainId: plan.chainId, label: plan.label, network: plan.network, genesisValidator: plan.genesisValidator,
    allocations: plan.allocations.length, fingerprint: await fingerprintGenesisPlan(plan),
    notice: 'Public configuration only, not a generated genesis. No identities or chain stores were opened or changed.'
  }, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
