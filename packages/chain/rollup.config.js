import json from '@rollup/plugin-json'
import esbuild from 'rollup-plugin-esbuild'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import modify from 'rollup-plugin-modify'

import { readdir, unlink } from 'fs/promises'
import { join } from 'path'

try {
  const dir = await readdir('./exports', { recursive: true })
  const promises = []

  for (const path of dir) {
    if (!path.endsWith('.d.ts')) promises.push(unlink(join('./exports', path)))
  }

  await Promise.allSettled(promises)
} catch (error) {}

export default [
  {
    input: [
      './src/chain.ts',
      './src/node.ts',
      './src/consensus/beacon.ts',
      './src/consensus/beacon-wire.ts',
      './src/consensus/beacon-envelope.ts',
      './src/consensus/beacon-epoch.ts',
      './src/consensus/beacon-round.ts',
      './src/consensus/beacon-lifecycle.ts'
    ],
    output: {
      dir: './exports',
      format: 'es'
    },
    plugins: [
      json(),
      esbuild({ target: 'es2022' }),
      modify({
        '@leofcoin/workers/machine-worker.js': 'workers/machine-worker.js',
        '@leofcoin/workers/src/block-worker.js': 'block-worker.js'
      })
    ]
  },
  {
    input: [
      './src/chain.ts',
      './src/node-browser.ts',
      './src/consensus/beacon.ts',
      './src/consensus/beacon-wire.ts',
      './src/consensus/beacon-envelope.ts',
      './src/consensus/beacon-epoch.ts',
      './src/consensus/beacon-round.ts',
      './src/consensus/beacon-lifecycle.ts',
      './../../node_modules/@leofcoin/storage/exports/browser-store.js'
    ],
    output: {
      dir: './exports/browser',
      format: 'es'
    },
    plugins: [
      json(),
      nodeResolve({
        browser: true,
        preferBuiltins: false,
        mainFields: ['module', 'browser']
      }),
      // globals(),
      // polyfill(),
      // builtins(),
      commonjs({ exclude: ['simple-peer', './simple-peer.js'] }),
      esbuild({ target: 'es2022' }),
      modify({
        '@leofcoin/workers/machine-worker.js': 'workers/machine-worker.js',
        '@leofcoin/workers/block-worker.js': 'block-worker.js'
      })
    ]
  },
  {
    input: ['./../workers/exports/browser/machine-worker.js', './../workers/exports/browser/block-worker.js'],
    output: {
      dir: './exports/browser/workers',
      format: 'es'
    },
    plugins: [
      json(),
      nodeResolve({
        mainFields: ['module', 'browser']
      }),
      commonjs({ exclude: ['simple-peer', './simple-peer.js'] }),
      modify({
        '@leofcoin/workers/block-worker.js': './block-worker.js'
      })
    ]
  },
  {
    input: ['./../workers/exports/machine-worker.js', './../workers/exports/block-worker.js'],
    output: {
      dir: './exports/workers',
      format: 'es'
    },
    plugins: [
      json(),
      nodeResolve({
        mainFields: ['module', 'browser']
      }),
      commonjs({ exclude: ['simple-peer', './simple-peer.js'] }),
      modify({
        '@leofcoin/workers/block-worker.js': 'block-worker.js'
      })
    ]
  }
]
