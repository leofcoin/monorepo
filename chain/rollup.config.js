import json from '@rollup/plugin-json'
import strip from '@rollup/plugin-strip';
import { terser } from "rollup-plugin-terser";

import { execSync } from 'node:child_process'

try {
  execSync(`rm -rf ./dist/**`)

} catch (e) {

}
export default [{
  input: ['./src/chain.js'],
  output: {
    dir: './dist',
    format: 'cjs'
  },
  plugins: [
    json(),
    // terser({
    //   keep_classnames: true
    // }),
  ]
}, {
  input: ['./src/node.js'],
  output: {
    dir: 'dist',
    format: 'cjs'
  },
  plugins: [
    json(),
    // terser({
    //   keep_classnames: true
    // }),
    // cjs()
  ]
}, {
  input: ['./src/chain.js'],
  output: {
    dir: './dist/module',
    format: 'es'
  },
  plugins: [
    json(),
    // terser({
    //   keep_classnames: true
    // }),
  ]
}, {
  input: ['./src/node.js'],
  output: {
    dir: 'dist/module',
    format: 'es'
  },
  plugins: [
    json(),
    // terser({
    //   keep_classnames: true
    // }),
    // cjs()
  ]
}, {
  input: ['./../workers/src/machine-worker.js'],
  output: {
    dir: 'dist/module/workers',
    format: 'es'
  },
  plugins: [
    json(),
    // cjs()
  ]
}, {
  input: ['./../workers/src/block-worker.js'],
  output: {
    dir: 'dist/module/workers',
    format: 'es'
  },
  plugins: [
    json(),
    // cjs()
  ]
}, {
  input: ['./../workers/src/transaction-worker.js'],
  output: {
    dir: 'dist/module/workers',
    format: 'es'
  },
  plugins: [
    json(),
    // cjs()
  ]
}, {
  input: ['./../workers/src/pool-worker.js'],
  output: {
    dir: 'dist/module/workers',
    format: 'es'
  },
  plugins: [
    json(),
    // cjs()
  ]
}, {
  input: ['./../workers/src/machine-worker.js'],
  output: {
    dir: 'dist/workers',
    format: 'cjs'
  },
  plugins: [
    json(),
    terser({
      keep_classnames: true
    }),
    // cjs()
  ]
}, {
  input: ['./../workers/src/transaction-worker.js'],
  output: {
    dir: 'dist/workers',
    format: 'cjs'
  },
  plugins: [
    json(),
    terser({
      keep_classnames: true
    }),
    // cjs()
  ]
}, {
  input: ['./../workers/src/pool-worker.js'],
  output: {
    dir: 'dist/workers',
    format: 'cjs'
  },
  plugins: [
    json(),
    terser({
      keep_classnames: true
    }),
    // cjs()
  ]
}, {
  input: ['./../workers/src/block-worker.js'],
  output: {
    dir: './',
    format: 'cjs'
  },
  plugins: [
    json(),
    terser({
      keep_classnames: true
    }),
    // cjs()
  ]
}, {
  input: ['src/contracts/factory.js'],
  output: {
    dir: 'dist/contracts',
    format: 'es'
  },
  plugins: [
    json(),
    strip(),
    terser({
      mangle: false,
      format: {semicolons: true },
      keep_classnames: true,
      ecma: 6
    })
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
}, {
  input: ['src/contracts/name-service.js'],
  output: {
    dir: 'dist/contracts',
    format: 'es'
  },
  plugins: [
    json(),
    strip(),
    terser({
      mangle: false,
      format: {semicolons: true, wrap_iife: true},
      keep_classnames: true,
      ecma: 6
    })
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
}, {
  input: ['src/contracts/native-token.js'],
  output: {
    dir: 'dist/contracts',
    format: 'es'
  },
  plugins: [
    json(),
    strip(),
    terser({
      mangle: false,
      keep_classnames: true,
      ecma: 6
    })
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
},{
  input: ['src/contracts/validators.js'],
  output: {
    dir: 'dist/contracts',
    format: 'es'
  },
  plugins: [
    json(),
    strip(),
    terser({
      mangle: false,
      format: {semicolons: true, wrap_iife: true},
      keep_classnames: true,
      ecma: 6
    })
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
}, {
  input: ['src/standards/token.js'],
  output: {
    dir: 'dist/standards',
    format: 'es'
  },
  plugins: [
    json(),
    strip(),
    terser({
      mangle: false,
      format: {semicolons: true, wrap_iife: true},
      keep_classnames: true,
      ecma: 6
    })
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
}]
