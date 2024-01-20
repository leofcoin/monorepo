import json from '@rollup/plugin-json'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import esbuild from 'rollup-plugin-esbuild'
export default [
  {
    input: ['./src/utils.ts'],
    output: {
      dir: './exports',
      format: 'es'
    },
    plugins: [
      json(),
      typescript(),
      resolve({
        preferBuiltins: true
      }),
      commonjs({
        include: ['node_modules/bn.js/lib/bn.js', '../../node_modules/bn.js/lib/bn.js']
      })
    ]
  },
  {
    input: ['./src/utils.ts'],
    output: {
      dir: './exports/browser',
      format: 'es'
    },
    plugins: [
      json(),
      esbuild(),
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
