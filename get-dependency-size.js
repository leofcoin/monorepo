import { mkdir, opendir, stat, writeFile } from 'fs/promises'
import { glob } from 'fs/promises'
import { join } from 'path'

import { readFile } from 'fs/promises'

try {
  await opendir(join(process.cwd(), '.dependency-size'))
} catch (error) {
  await mkdir(join(process.cwd(), '.dependency-size'), { recursive: true })
}

let file = '{}'
try {
  file = (await readFile('.dependency-size/history.json')).toString()
} catch (error) {}

const previousSize = JSON.parse(file)

const dirs = await glob(['./node_modules/**', 'packages/**/node_modules/**'], {
  cwd: process.cwd(),
  recursive: true
})

let totalSize = 0

for await (const dir of dirs) {
  const { size } = await stat(dir)
  totalSize += size
}

const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)
console.log(`Total size of node_modules: ${totalSizeMB} MB (${totalSize} bytes)`)

if (previousSize?.totalSize) {
  const difference = totalSize - previousSize.totalSize
  const differenceMB = (difference / (1024 * 1024)).toFixed(2)

  writeFile(join(process.cwd(), '.dependency-size', 'history.json'), JSON.stringify({ totalSize }))
  console.log(`Difference: ${differenceMB} MB (${difference} bytes)`)
} else {
  writeFile(join(process.cwd(), '.dependency-size', 'history.json'), JSON.stringify({ totalSize }))
  console.log('This is the first recorded size.')
}
