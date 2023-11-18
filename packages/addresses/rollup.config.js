import json from '@rollup/plugin-json'

export default [{
  input: ['./src/addresses.js'],
  output: [{
    file: './exports/addresses.js',
    format: 'es'
  }],
  plugins: [
    json()
  ]
}]
