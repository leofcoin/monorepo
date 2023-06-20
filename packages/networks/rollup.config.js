import defaultToJSON from 'rollup-plugin-default-to-json'

export default [{
  input: './src/networks.js',
  output: [{
    file: './networks.js',
    format: 'es'
  }],
  plugins: [defaultToJSON()]
}]