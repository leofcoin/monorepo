import json from '@rollup/plugin-json'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
export default [
  {
    input: ['./src/utils.ts'],
    output: {
      dir: './exports',
      format: 'es'
    },
    plugins: [json(), typescript()]
  },
  {
    input: ['./src/utils.ts'],
    output: {
      dir: './exports/browser',
      format: 'es'
    },
    plugins: [
      json(),
      typescript({ compilerOptions: { declaration: false, outDir: 'exports/browser' } }),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs({
        include: ['node_modules/bn.js/lib/bn.js', '../../node_modules/bn.js/lib/bn.js']
      })
    ]
  }
]
