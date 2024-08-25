import json from '@rollup/plugin-json'
import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import modify from 'rollup-plugin-modify'

import { readdir, unlink } from 'fs/promises'
import { join } from 'path'

const dir = await readdir('./exports', { recursive: true })
const promises = []

for (const path of dir) {
  promises.push(unlink(join('./exports', path)))
}

await Promise.allSettled(promises)

export default [
  {
    input: ['./src/chain.ts', './src/node.ts'],
    output: {
      dir: './exports',
      format: 'es'
    },
    plugins: [
      json(),
      typescript({
        compilerOptions: { outDir: './exports', declaration: true, declarationDir: './exports' },
        exclude: ['node_modules'],
        include: ['./src/**/*']
      }),
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
      typescript({
        compilerOptions: { outDir: './exports/browser', declaration: false, declarationDir: './exports/browser' },
        exclude: ['node_modules'],
        include: ['./src/**/*']
      }),

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
