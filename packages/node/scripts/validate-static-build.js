import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', 'www')
const requiredFiles = [
  'index.html',
  'shell.js',
  'sw.js',
  'manifest.json',
  'chain/node-browser.js',
  'chain/chain.js',
  'monaco/monaco-loader.js'
]

await Promise.all(requiredFiles.map((file) => access(join(root, file))))

const bundles = await Promise.all([
  readFile(join(root, 'shell.js'), 'utf8'),
  readFile(join(root, 'editor.js'), 'utf8')
])

for (const bundle of bundles) {
  if (bundle.includes('/packages/node/')) {
    throw new Error('static bundle contains a source-tree asset URL')
  }
}

if (!/new URL\(["']\.\/chain\/node-browser\.js["'], document\.baseURI\)/.test(bundles[0])) {
  throw new Error('browser-node bundle does not resolve chain assets from the deployed base URL')
}

if (!/new URL\(["']\.\/chain\/chain\.js["'], document\.baseURI\)/.test(bundles[0])) {
  throw new Error('browser-node bundle does not resolve the chain runtime from the deployed base URL')
}

if (!/new URL\(["']\.\/monaco\/monaco-loader\.js["'], document\.baseURI\)/.test(bundles[1])) {
  throw new Error('editor bundle does not resolve Monaco from the deployed base URL')
}

console.log(`validated ${requiredFiles.length} required static assets`)
