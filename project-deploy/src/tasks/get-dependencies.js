import { join } from 'path'
import { glob, read, getLogger } from './../utils.js'

export default async () => {
  const paths = await glob(['node_modules/**/**/*.sol'])
  const sources = {}
  for (const path of paths) {
    let content = await read(path)
    content = content.toString()
    sources[path] = { content }
  }
  return sources
}
