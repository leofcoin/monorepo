import json from '@rollup/plugin-json'
import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import rimraf from 'rimraf'
import modify from 'rollup-plugin-modify'
import builtins from 'rollup-plugin-node-builtins'
import globals from 'rollup-plugin-node-globals'
rimraf.sync('./exports')
export default [{
  input: ['./src/chain.ts', './src/node.ts'],
  output: {
    dir: './exports',
    format: 'es'
  },
  plugins: [
    json(),
    typescript({compilerOptions: {'outDir': './exports', 'declaration': true, 'declarationDir': './exports'}, exclude: ['node_modules'], 'include': ['./src/**/*']}),
    modify({
      '@leofcoin/workers/machine-worker.js': 'workers/machine-worker.js',
      '@leofcoin/workers/src/block-worker.js': 'block-worker.js',
    })
  ]
}, {
  input: ['./src/chain.ts', './src/node-browser.ts', './../../node_modules/@leofcoin/storage/exports/browser-store.js'],
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
    typescript({compilerOptions: {'outDir': './exports/browser', 'declaration': false, 'declarationDir': './exports/browser'}, exclude: ['node_modules'], 'include': ['./src/**/*']}),
   
    modify({
      '@leofcoin/workers/machine-worker.js': 'workers/machine-worker.js',
      '@leofcoin/workers/block-worker.js': 'block-worker.js',
    })
  ]
}, {
  input: './../workers/src/machine-worker.js',
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
      '@leofcoin/workers/block-worker.js': './block-worker.js',
    })
  ]
}, {
  input: './../workers/src/machine-worker.js',
  output: {
    file: './exports/workers/machine-worker.js',
    format: 'es'
  },
  plugins: [
    json(),
    nodeResolve({
      mainFields: ['module', 'browser']
    }),
    commonjs({exclude: ['simple-peer', './simple-peer.js']}),
    modify({
      '@leofcoin/workers/block-worker.js': 'block-worker.js',
    })
  ]
}, {
  input: './../workers/src/block-worker.js',
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
}, {
  input: './../workers/src/block-worker.js',
  output: {
    file: './exports/workers/block-worker.js',
    format: 'es'
  },
  plugins: [
    json(),
    nodeResolve(),
    commonjs({exclude: ['simple-peer', './simple-peer.js']})
  ]
}]
