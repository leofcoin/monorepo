import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

export default {
  input: ['src/storage.ts', 'src/browser-store.ts', 'src/store.ts', 'src/path.ts', 'src/value.ts', 'src/encoding.ts'],
  output: {
    dir: 'exports',
    format: 'es'
  },
  external: ['path', 'classic-level', 'os', 'fs', 'fs/promises', './browser-store.js', './store.js',
    './value.js', './path.js', './encoding.js'],
  plugins: [resolve(), typescript()]
}
