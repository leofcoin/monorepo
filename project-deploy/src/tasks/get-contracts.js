import { join } from 'path'
import { glob, read, getLogger } from './../utils.js'

export default async () => {
  const paths = await glob(['**/**/*.sol', '!node_modules'])
  const sources = {}
  for (const path of paths) {
    let content = await read(path)
    content = content.toString()
    sources[path] = { content }
  }
  return sources
}
