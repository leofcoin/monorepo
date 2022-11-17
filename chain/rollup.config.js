import json from '@rollup/plugin-json'
import strip from '@rollup/plugin-strip';
import { terser } from "rollup-plugin-terser";

import { execSync } from 'child_process'

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
  input: ['./node_modules/@leofcoin/workers/src/machine-worker.js'],
  output: {
    dir: 'dist/module/workers',
    format: 'es'
  },
  plugins: [
    json(),
    // cjs()
  ]
}, {
  input: ['./node_modules/@leofcoin/workers/src/block-worker.js'],
  output: {
    dir: 'dist/module/workers',
    format: 'es'
  },
  plugins: [
    json(),
    // cjs()
  ]
}, {
  input: ['./node_modules/@leofcoin/workers/src/transaction-worker.js'],
  output: {
    dir: 'dist/module/workers',
    format: 'es'
  },
  plugins: [
    json(),
    // cjs()
  ]
}, {
  input: ['./node_modules/@leofcoin/workers/src/pool-worker.js'],
  output: {
    dir: 'dist/module/workers',
    format: 'es'
  },
  plugins: [
    json(),
    // cjs()
  ]
}, {
  input: ['./node_modules/@leofcoin/workers/src/machine-worker.js'],
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
  input: ['./node_modules/@leofcoin/workers/src/transaction-worker.js'],
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
  input: ['./node_modules/@leofcoin/workers/src/pool-worker.js'],
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
  input: ['./node_modules/@leofcoin/workers/src/block-worker.js'],
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
      keep_classnames: true
    })
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
}, {
  input: ['src/contracts/nameService.js'],
  output: {
    dir: 'dist/contracts',
    format: 'es'
  },
  plugins: [
    json(),
    strip(),
    terser({
      mangle: false,
      keep_classnames: true
    })
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
}, {
  input: ['src/contracts/nativeToken.js'],
  output: {
    dir: 'dist/contracts',
    format: 'es'
  },
  plugins: [
    json(),
    strip(),
    terser({
      mangle: false,
      keep_classnames: true
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
      keep_classnames: true
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
      keep_classnames: true
    })
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
}]
