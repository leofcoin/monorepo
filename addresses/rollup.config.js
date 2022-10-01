import json from '@rollup/plugin-json'

export default [{
  input: ['./src/addresses.js'],
  output: {
    dir: './dist',
    format: 'cjs'
  },
  plugins: [
    json()
  ]
}]
