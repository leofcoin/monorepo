import cjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import strip from '@rollup/plugin-strip';
import { terser } from "rollup-plugin-terser";
import modify from 'rollup-plugin-modify'

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
    json()
    // terser({
    //   keep_classnames: true
    // }),
    // cjs()
  ]
}, {
  input: ['./src/node.js'],
  output: {
    dir: 'dist',
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
