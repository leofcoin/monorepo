import json from '@rollup/plugin-json'
import typescript from '@rollup/plugin-typescript'

export default [{
  input: ['./src/index.ts', './src/node-config.ts'],
  output: {
    dir: './exports',
    format: 'es'
  },
  plugins: [
    json(),
    typescript()
  ]
}]
