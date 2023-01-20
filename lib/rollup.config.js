import json from '@rollup/plugin-json'
import typescript from '@rollup/plugin-typescript'
import tsConfig from './tsconfig.json' assert { type: 'json'}

export default [{
  input: ['./src/lib.ts'],
  output: {
    dir: './exports',
    format: 'es'
  },
  plugins: [
    json(),
    typescript(tsConfig)
  ]
}]
