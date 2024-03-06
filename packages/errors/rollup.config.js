import typescript from '@rollup/plugin-typescript'
export default [
  {
    input: ['./src/errors.ts'],
    output: {
      dir: './exports',
      format: 'es'
    },
    plugins: [typescript()]
  }
]
