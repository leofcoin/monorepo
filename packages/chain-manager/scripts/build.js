import { build } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
await mkdir(new URL('dist/', root), { recursive: true })
await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['src/app.ts', 'src/manager.ts', 'src/presence.ts', 'src/operator.ts', 'src/genesis.ts', 'src/templates.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  splitting: true,
  target: 'es2022',
  outdir: 'dist',
  minify: true,
  tsconfig: 'tsconfig.json',
  inject: [fileURLToPath(new URL('src/browser-globals.ts', root))],
  alias: { crypto: fileURLToPath(new URL('src/crypto.ts', root)) }
})
await Promise.all(['index.html', 'style.css'].map(file =>
  copyFile(new URL(`src/${file}`, root), new URL(`dist/${file}`, root))
))
