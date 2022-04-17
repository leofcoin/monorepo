import {execSync} from 'child_process'

try {
  execSync('rm ./dist/*.js')
} catch (e) {
  console.log('nothing to clean');
}

export default  [{
  input: ['src/index.js', 'src/server/server.js', 'src/client/client.js'],
  output: [{
    dir: './dist/es',
    format: 'es'
  }, {
    dir: './dist/commonjs',
    format: 'cjs',
    exports: 'auto'
  }]
}]
