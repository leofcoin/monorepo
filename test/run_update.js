const { join } = require('path')
const ethers = require('ethers')
const ora = require('ora');

const deploy = require('./deploy_new_art')
const setArt = require('./set_new_art')

// let addresses = require(join(__dirname, './../addresses/addresses/binance-smartchain-testnet.json'))

const dotenv = require('dotenv').config()
const config = dotenv.parsed

const network = 'binance-smartchain'

const rpcUrls =  {
  'art-ganache': 'http://127.0.0.1:1337',
  'binance-smartchain-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
  'binance-smartchain': 'https://bsc-dataseed.binance.org'
}
const chainIds =  {
  'art-ganache': 1337,
  'binance-smartchain-testnet': 97,
  'binance-smartchain': 56
}

let addresses = require(join(__dirname, `./../addresses/addresses/${network}.json`))

const provider = new ethers.providers.JsonRpcProvider( rpcUrls[network], {
  chainId: chainIds[network]
})
// 127.0.0.1:1337

const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider)

const logger = ora('Running Update').start();

const update = async () => {
  // deploy and get new addresses
  // addresses = await deploy(addresses, signer, logger, network)

  await setArt(addresses, signer, logger, network)
}

update()
