import json from '@rollup/plugin-json'
import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import tsConfig from './tsconfig.json' assert { type: 'json'}
import commonjs from '@rollup/plugin-commonjs'

export default [{
  input: ['./src/chain.ts', './src/node.ts'],
  output: {
    dir: './exports',
    format: 'es'
  },
  plugins: [
    json(),
    typescript(tsConfig)
  ]
}, {
  input: ['./src/chain.ts', './src/node-browser.ts', './node_modules/@leofcoin/storage/exports/browser-store.js'],
  output: {
    dir: './exports/browser',
    format: 'es'
  },
  plugins: [
    json(),
    nodeResolve({
      mainFields: ['module', 'browser']
    }),
    commonjs({exclude: ['simple-peer', './simple-peer.js']}),
    typescript({...tsConfig, compilerOptions: {'outDir': './exports/browser', 'declaration': false, 'declarationDir': './exports/browser'}})
  ]
}]
