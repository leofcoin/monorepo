import { opendir, stat } from 'fs/promises'
import { glob } from 'fs/promises'

import { join } from 'path'

const dirs = await glob(['node_modules', 'packages/*/node_modules'], {
  cwd: process.cwd(),
  recursive: true
})

let totalSize = 0

for await (const dir of dirs) {
  const { size } = await stat(dir)
  totalSize += size
}
console.log(`Total size of node_modules: ${totalSize} bytes`)

await opendir(join(process.cwd(), 'packages'))
