import typescript from '@rollup/plugin-typescript'

export default [
  {
    input: [
      './src/index.ts',
      './src/node.ts',
      './src/validator.ts',
      './src/cli-options.ts',
      './src/cli.ts',
      './src/validator-cli.ts'
    ],
    output: {
      format: 'es',
      dir: './exports'
    },
    plugins: [typescript()]
  }
]
