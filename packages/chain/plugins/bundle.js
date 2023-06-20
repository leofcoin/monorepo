import rollup from 'rollup'

const config = {
  input: ['src/interfaces/token.js'],
  output: {
    dir: 'dist',
    format: 'es'
  },
  plugins: [
    json(),
    strip(),
    terser({
      mangle: true,
      keep_classnames: true
    })
    // resolve({preferBuiltins: false,browser: false, extensions: ['.js', '.mjs', '.node']}),
  ]
}
