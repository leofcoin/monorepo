import cjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
export default [{
  input: ['./src/chain.js', 'src/interfaces/token.js'],
  output: {
    dir: 'dist',
    format: 'cjs'
  },
  plugins: [
    json(),
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
}, {
  input: ['src/token/native.js'],
  output: {
    dir: 'dist',
    format: 'es'
  },
  plugins: [
    json(),
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
}]
