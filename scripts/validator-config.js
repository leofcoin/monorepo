import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

export const validatorPasswordFile = (args, env = process.env, root = repositoryRoot) => {
  if (args.some((arg) => ['--help', '-h', '--version', '-v', '--password-file'].includes(arg))) return undefined
  if (env.LEOFCOIN_PASSWORD_FILE || env.LEOFCOIN_PASSWORD) return undefined
  if (env.GENESIS_PASSWORD_FILE) return resolve(root, env.GENESIS_PASSWORD_FILE)

  let network = env.LEOFCOIN_NETWORK || 'leofcoin:peach'
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--network') network = args[++index]
  }
  if (network !== 'leofcoin:peach' && !env.LFC_GENESIS_CREDENTIALS_DIR) {
    throw new Error('set LEOFCOIN_PASSWORD_FILE for a non-Peach validator; Peach credentials are not reused across networks')
  }
  return resolve(root, env.LFC_GENESIS_CREDENTIALS_DIR || 'genesis-credentials/leofcoin-peach', 'genesis-password.txt')
}
