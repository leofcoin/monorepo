// Keep the repository convenience command aligned with the public package CLI.
import { validatorPasswordFile } from './validator-config.js'

try {
  const file = validatorPasswordFile(process.argv.slice(2))
  if (file) process.env.LEOFCOIN_PASSWORD_FILE = file
  await import('../packages/launch-chain/exports/validator-cli.js')
} catch (error) {
  process.stderr.write(`validator: ${error?.message ?? error}\n`)
  process.exitCode = 1
}
