import json from '@rollup/plugin-json'

export default [{
  input: ['./src/lib.js'],
  output: {
    dir: './dist',
    format: 'cjs'
  },
  plugins: [
    json()
  ]
}, {
  input: ['./src/lib.js'],
  output: {
    file: './dist/lib.esm',
    format: 'es'
  },
  plugins: [
    json()
  ]
}]
