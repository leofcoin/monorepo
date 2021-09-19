const {readdir, writeFile, readFile } = require('fs')
const { promisify } = require('util')
const glob = require('globby')
// const ignoreList = ['.git', '.gitignore', '.gitattributes', 'contract-utils', 'LICENSE', 'README.md', 'testnet', 'node_modules', 'package-lock.json']

const read = promisify(readFile)
const write = promisify(writeFile)

let network = 'mainnet'
let pragma

for (const arg of process.argv) {
  if (arg === 'pragma') pragma = process.argv[process.argv.indexOf(arg) + 1]
  if (arg === 'network') network = process.argv[process.argv.indexOf(arg) + 1] || network
}
const dir = network === 'testnet' ? './testnet' : './'

const filter = array => {
  for (const path of ignoreList) {
    const indexOf = array.indexOf(path)
    if (indexOf !== -1) array.splice(indexOf, 1)
  }
  return array
};

(async () => {
  if (pragma) {
    const paths = await glob(['**/**/*.sol', '!node_modules', '!testnet/node_modules'])
    console.log(paths);
    for (path of paths) {
      let data = await read(path)
      data = data.toString()
      await write(path, data.replace(/pragma solidity (.*);/g, `pragma solidity ${pragma};`))
    }
  }

})();
// if (pragma)
// readdir(dir, (err, paths) => {
// console.log(paths);
  // paths = filter(paths)
  // console.log(paths);
// })
