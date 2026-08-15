import typescript from '@rollup/plugin-typescript'
export default [{
  input: ['./src/index.ts', './src/http.ts', './src/ws.ts', './src/direct.ts'],
  output: {
    dir: './exports',
    format: 'es'
  },
  plugins: [
    typescript()
  ],
  external: [
    './identity.js'
  ]
}]
