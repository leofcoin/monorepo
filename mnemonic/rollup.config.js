import typescript from '@rollup/plugin-typescript';
import tsconfig from './tsconfig.json' assert { type: 'json'};

export default [{
  input: ['./src/index.ts'],
  output: {
    format: 'es',
    dir: './'
  },
  plugins: [
    typescript(tsconfig)
  ]
}]