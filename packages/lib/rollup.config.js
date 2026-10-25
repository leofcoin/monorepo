import json from '@rollup/plugin-json'
import typescript from '@rollup/plugin-typescript'

export default [{
  input: ['./src/index.ts', './src/node-config.ts', './src/genesis-plan.ts', './src/chain-identity.ts'],
  output: {
    dir: './exports',
    format: 'es'
  },
  plugins: [
    json(),
    typescript()
  ]
}]
