export const isBrowser = globalThis.process?.versions?.node ? false : true
export const isNotFoundError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotFoundError'

export const init = async (root: string, home = true) => {
  let _root = root
  const join = (await import('path')).join
  if (home) {
    const homedir = (await import('os')).homedir
    _root = join(homedir(), root)
  }
  const readdir = (await import('fs/promises')).readdir
  try {
    await readdir(_root)
  } catch (e) {
    const mkdir = (await import('fs/promises')).mkdir
    await mkdir(_root, { recursive: true })
  }
  return _root
}
