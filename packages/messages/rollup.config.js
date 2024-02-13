import typescript from '@rollup/plugin-typescript'

export default [
  {
    input: [
      './src/index.ts',
      './src/messages/block.ts',
      './src/messages/bw.ts',
      './src/messages/bw-request.ts',
      './src/messages/contract.ts',
      './src/messages/last-block.ts',
      './src/messages/last-block-request.ts',
      './src/messages/transaction.ts',
      './src/messages/validator.ts',
      './src/messages/state.ts'
    ],
    output: {
      format: 'es',
      dir: './exports'
    },
    plugins: [typescript()]
  }
]
