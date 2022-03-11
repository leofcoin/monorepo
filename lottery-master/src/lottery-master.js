import _reveal from './tasks/reveal'
import _create from './tasks/create'
import { join } from 'path'
import ethers from 'ethers'

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

let addresses = require(join(__dirname, `./../../addresses/addresses/${network}.json`))

const provider = new ethers.providers.JsonRpcProvider( rpcUrls[network], {
  chainId: chainIds[network]
})
// 127.0.0.1:1337

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider)

export const reveal = async (lottery, numbers, matches) => _reveal(addresses, provider, signer, lottery, numbers, matches)

export const create = async (
  ticketPrice = ethers.utils.parseUnits('1000', 18),
  startDelay = 60,
  duration = 120,
  pot = 100000) => _create(addresses, provider, signer, ticketPrice, startDelay, duration, pot)

export default {
  addresses,
  reveal,
  create,
  ethers,
  signer
}
