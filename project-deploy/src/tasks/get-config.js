import { read, glob } from './../utils.js'

const get = async path => {
  const file = await read(path)
  return JSON.parse(file)
}

const _import = async path => {
  const importee = await import(path)
  return importee.default
}

export default async (config = {}) => {
  const paths = await glob(['project-deploy.config.*'])

  if (paths.length > 0) config = paths[0].includes('.json') && await get(paths[0])
  return config
}
