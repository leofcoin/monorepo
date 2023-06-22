import typescript from '@rollup/plugin-typescript'
import defaultToJSON from 'rollup-plugin-default-to-json'

export default [{
  input: './src/networks.ts',
  output: [{
    dir: 'exports',
    format: 'es'
  }],
  plugins: [defaultToJSON(), typescript()]
}]