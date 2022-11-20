import json from '@rollup/plugin-json'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve';
import modify from 'rollup-plugin-modify';
import { execSync } from 'child_process'
import styles from "rollup-plugin-styles";

try {
  execSync('rm -rf app/*.js')
} catch {

}

export default [{
  input: ['src/www/shell.js', 'src/www/views/wallet.js', 'src/www/views/stats.js', 'src/www/views/validator.js', 'src/www/views/editor.js'],
  output: [{
    format: 'es',
    dir: 'app'
  }],
  external: [
    './api.js'
  ],
  plugins: [
    json(),    
    commonjs(),
    nodeResolve(),
    styles()
  ]
}, {
  input: ['src/api.js', 'src/preload.js'],
  output: [{
    format: 'cjs',
    dir: 'app'
  }],
  plugins: [
    json(),
    commonjs(),
		modify({
			SUBTLE_IMPORT: `const { subtle } = crypto`
		})
  ]
}, {
  input: 'src/index.js',
  output: [{
    format: 'cjs',
    dir: 'app'
  }]
}, {
  input: ['./node_modules/@leofcoin/workers/src/machine-worker.js'],
  output: [{
    dir: 'app/workers',
    format: 'cjs'
  }, {
    dir: 'workers',
    format: 'cjs'
  }],
  plugins: [
    json(),
  ]
}, {
  input: ['./node_modules/@leofcoin/workers/src/block-worker.js'],
  output: [{
    dir: 'app/',
    format: 'cjs'
  }, {
    dir: './',
    format: 'cjs'
  }],
  plugins: [
    json()
  ]
}, {
  input: ['./node_modules/@leofcoin/workers/src/transaction-worker.js'],
  output: [{
    dir: 'app/workers',
    format: 'cjs'
  }, {
    dir: 'workers',
    format: 'cjs'
  }],
  plugins: [
    json()
  ]
}, {
  input: ['./node_modules/@leofcoin/workers/src/pool-worker.js'],
  output: [{
    dir: 'app/workers',
    format: 'cjs'
  }, {
    dir: 'workers',
    format: 'cjs'
  }],
  plugins: [
    json()
  ]
}]
