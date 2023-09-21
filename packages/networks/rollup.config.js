import typescript from '@rollup/plugin-typescript'

export default [{
  input: './src/networks.ts',
  output: [{
    dir: 'exports',
    format: 'es'
  }],
  plugins: [typescript()]
}]