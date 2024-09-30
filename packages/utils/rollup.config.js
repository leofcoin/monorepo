import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
export default [
  {
    input: ['./src/utils.ts'],
    output: {
      dir: './exports',
      format: 'es'
    },
    plugins: [typescript(), nodeResolve()]
  }
]
