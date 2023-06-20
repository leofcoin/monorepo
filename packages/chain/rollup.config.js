import json from '@rollup/plugin-json'
import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import rimraf from 'rimraf'
import modify from 'rollup-plugin-modify'
rimraf.sync('./exports')
export default [{
  input: ['./src/chain.ts', './src/node.ts'],
  output: {
    dir: './exports',
    format: 'es'
  },
  plugins: [
    typescript({compilerOptions: {'outDir': './exports', 'declaration': true, 'declarationDir': './exports/types'}}),
    json(),
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
    typescript({compilerOptions: {'outDir': './exports/browser', 'declaration': false, 'declarationDir': './exports/browser'}}),
    modify({
      'node_modules/@leofcoin/workers/src/machine-worker.js': './exports/browser/workers/machine-worker.js',
      'node_modules/@leofcoin/workers/src/block-worker.js': './block-worker.js',
    })
  ]
}, {
  input: './node_modules/@leofcoin/workers/src/machine-worker.js',
  output: {
    file: './exports/browser/workers/machine-worker.js',
    format: 'es'
  },

  plugins: [
    json(),
    nodeResolve({
      mainFields: ['module', 'browser']
    }),
    commonjs({exclude: ['simple-peer', './simple-peer.js']}),
    modify({
      'node_modules/@leofcoin/workers/src/machine-worker.js': './exports/browser/workers/machine-worker.js',
      'node_modules/@leofcoin/workers/src/block-worker.js': './block-worker.js',
    })
  ]
}, {
  input: './node_modules/@leofcoin/workers/src/block-worker.js',
  output: {
    file: './exports/browser/workers/block-worker.js',
    format: 'es'
  },
  plugins: [
    json(),
    nodeResolve({
      mainFields: ['module', 'browser']
    }),
    commonjs({exclude: ['simple-peer', './simple-peer.js']})
  ]
}]
