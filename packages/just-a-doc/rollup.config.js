import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy'

export default {
  input: ['src/index.ts'],
  output: {
    dir: 'dist',
    format: 'es'
  },
  plugins: [
    typescript(),
    copy({
      targets: [{
        src: 'src/templates', dest: 'dist'
      }]
    })
  ]
};