import { randomBytes } from 'node:crypto'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const generateGenesisPassword = () => randomBytes(32).toString('base64url')

export const genesisCredentialPaths = (directory = 'genesis-credentials/leofcoin-peach') => {
  const root = resolve(directory)
  return {
    root,
    password: resolve(root, 'genesis-password.txt'),
    identity: resolve(root, 'genesis-identity.backup'),
    readme: resolve(root, 'README.txt')
  }
}

const writePrivateFile = async (path, contents) => {
  await writeFile(path, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
}

export const prepareGenesisCredentials = async ({ directory, password } = {}) => {
  const paths = genesisCredentialPaths(directory)
  await mkdir(paths.root, { recursive: true, mode: 0o700 })
  await chmod(paths.root, 0o700)
  const generatedPassword = password || generateGenesisPassword()
  await writePrivateFile(paths.password, `${generatedPassword}\n`)
  return { password: generatedPassword, paths }
}

export const writeGenesisIdentityBackup = async ({ identity, account, paths }) => {
  if (typeof identity !== 'string' || identity.length === 0) throw new Error('identity export is empty')
  await writePrivateFile(paths.identity, `${identity}\n`)
  await writePrivateFile(
    paths.readme,
    [
      'Leofcoin genesis recovery bundle',
      '',
      `Genesis account: ${account}`,
      `Password: ${paths.password}`,
      `Encrypted identity: ${paths.identity}`,
      '',
      'Both files are required for recovery. Copy this directory to encrypted offline storage.',
      'Never commit or publish these files.'
    ].join('\n') + '\n'
  )
}
