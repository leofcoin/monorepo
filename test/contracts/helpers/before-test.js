const { join } = require('path')
const ethers = require('ethers')

const dotenv = require('dotenv').config()
const config = dotenv.parsed

const network = 'binance-smartchain-testnet'

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

const addresses = require(join(__dirname, `./../addresses/addresses/${network}.json`))

const provider = new ethers.providers.JsonRpcProvider( rpcUrls[network], {
  chainId: chainIds[network]
})
const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider)

const pause = async () => new Promise((resolve, reject) => {
  return setTimeout(() => {
    return resolve()
  }, 2000);
})

module.exports = {ethers, signer, provider, addresses, pause}
