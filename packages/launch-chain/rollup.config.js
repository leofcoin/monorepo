import typescript from '@rollup/plugin-typescript'

export default [
  {
    input: ['./src/index.ts', './src/validator.ts', './src/validator-cli.ts'],
    output: {
      format: 'es',
      dir: './exports'
    },
    plugins: [typescript()]
  }
]
