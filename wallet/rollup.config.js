
import json from '@rollup/plugin-json'

import { execSync } from 'child_process'

try {
  execSync(`rm -rf ./dist/**`)

} catch (e) {

}
export default [{
  input: ['./src/wallet.js'],
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
}]
