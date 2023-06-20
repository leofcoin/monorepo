import typescript from "@rollup/plugin-typescript"
import tsConfig from './tsconfig.json' assert { type: 'json'}


export default [{
  input: ['./src/index.ts'],
  output: {
    format: 'es',
    dir: './exports'
  },
  external: [
    './messages/block.js', 
    './messages/bw.js',
    './messages/bw-request.js',
    './messages/contract.js',
    './messages/last-block.js',
    './messages/last-block-request.js',
    './messages/transaction.js',
    './messages/validator.js'
  ],  
  plugins: [
    typescript(tsConfig)
  ]
}, {
  input: [
    './src/messages/block.ts',
    './src/messages/bw.ts',
    './src/messages/bw-request.ts',
    './src/messages/contract.ts',
    './src/messages/last-block.ts',
    './src/messages/last-block-request.ts',
    './src/messages/transaction.ts',
    './src/messages/validator.ts'
  ],
  output: {
    format: 'es',
    dir: './exports/messages'
  },
  external: [
    './messages/block.js', 
    './messages/bw.js',
    './messages/bw-request.js',
    './messages/contract.js',
    './messages/last-block.js',
    './messages/last-block-request.js',
    './messages/transaction.js',
    './messages/validator.js'
  ],  
  plugins: [
    typescript({"module": "ES2022",
    "target": "es2022",
    "moduleResolution":"NodeNext",
    "allowJs": true,
    "allowSyntheticDefaultImports": true, declaration: false, declarationDir: './exports/messages', outDir: './exports/messages'})
  ]
}]