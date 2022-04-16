import { writeFile } from 'fs'
import {globby} from 'globby'
import { promisify } from 'util'
import { parse } from 'path'

const write = promisify(writeFile
)
const glob = await globby(['./**/*.svg', './**/*.png', '!node_modules'])

const manifest = {}
for (const path of glob) {
  // console.log(file);
  const parsed = parse(path)
  manifest[parsed.name] = {
    path,
    name: parsed.name,
    extension: parsed.ext,
    url: `https://assets.artonline.site/${parsed.dir}/${parsed.base}`
  }

  await write('./manifest.js', `export default ${JSON.stringify(manifest, null, '\t')}`)
  // manifest[] = {
  //   category: path'general'
  // }
}
