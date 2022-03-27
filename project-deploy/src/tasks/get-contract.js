import { join } from 'path'
import { glob, read, getLogger } from './../utils.js'

export default async (path) => {
  const content = await read(path)
  const sources = {}
  sources[path] = { content: content.toString() }
  return sources
}
