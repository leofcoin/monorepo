import {execSync} from 'child_process'

execSync('rm -rf ./www/**/*.js')
execSync('rm -rf ./www/*.js')
execSync('cp ./node_modules/pdfjs-dist/build/pdf.worker.js ./www/')
execSync('cp ./node_modules/pdfjs-dist/build/pdf.worker.js.map ./www/')

export default [{
  input: ['src/shell.js', 'src/views/learn-more.js', 'src/views/whitepaper.js',
          'src/views/team.js', 'src/views/links.js', 'src/views/products.js',
          'src/views/products.js', 'src/views/products/platform.js',
          'src/views/products/exchange.js', 'src/views/products/lottery.js',
          'src/views/products/faucet.js'
         ],
  output: [{
    dir: 'www',
    format: 'es'
  }]
}]
