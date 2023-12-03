import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'

import { execSync } from 'child_process'

try {
  execSync(`npx rimraf './dist'`)

} catch (e) {

}

export default [{
  input: ['./src/wallet.js'],
  output: {
    dir: './dist',
    format: 'cjs'
  },
  
  external: ['@leofcoin/multi-wallet'],
  plugins: [
    json(),
    nodeResolve()
  ]
}]
