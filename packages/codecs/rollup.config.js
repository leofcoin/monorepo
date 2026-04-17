import typescript from '@rollup/plugin-typescript'

export default [
  {
    input: ['./src/index.ts', './src/codecs.ts', './src/utils.ts'],
    output: {
      dir: './exports',
      format: 'es'
    },
    plugins: [typescript()]
  }
]
