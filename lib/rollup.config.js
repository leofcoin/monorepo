import json from '@rollup/plugin-json'
import typescript from '@rollup/plugin-typescript'
import tsConfig from './tsconfig.json' assert { type: 'json'}

export default [{
  input: ['./src/index.ts', './src/node-config.ts'],
  output: {
    dir: './exports',
    format: 'es'
  },
  plugins: [
    json(),
    typescript(tsConfig)
  ]
}]
