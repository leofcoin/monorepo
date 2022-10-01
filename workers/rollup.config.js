import { execSync } from 'child_process'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'

import commonjs from '@rollup/plugin-commonjs'
try {
  execSync(`rm -rf ./dist/**`)

} catch (e) {

}
export default [{
  input: ['./src/workers.js', './src/transaction-worker.js', './src/block-worker.js', './src/pool-worker.js', './src/machine-worker.js'],
  
  plugins: [
    json()
  ],
  output: [{
    dir: './dist/commonjs',
    format: 'cjs'
  }, {    
    dir: './dist/module',
    format: 'es'
  }]
}, {
  input: ['./src/workers.js', './src/transaction-worker.js', './src/block-worker.js', './src/pool-worker.js', './src/machine-worker.js'],
  
  plugins: [
    json(),
    commonjs(),
    resolve()
  ],
  output: [{
    dir: './dist/bundle/commonjs',
    format: 'cjs'
  }, {    
    dir: './dist/bundle/module',
    format: 'es'
  }]
}]
