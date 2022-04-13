export default  [{
  input: ['src/index.js', 'src/server/server.js', 'src/client/client.js'],
  output: {
    dir: './dist',
    format: 'cjs',
    exports: 'auto'
  }
}]
