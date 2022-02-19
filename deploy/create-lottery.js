const { join } = require('path')
const ethers = require('ethers')
const ora = require('ora');
const { writeFile } = require('fs')
const { promisify } = require('util')
const write = promisify(writeFile)

const proxy = require('./proxy')
const createables = require('./createables')
const staking = require('./staking')
const lottery = require('./lottery')
const LOTTERY = require('./../build/contracts/ArtOnlineLottery.json');

// let addresses = require(join(__dirname, './../addresses/addresses/binance-smartchain-testnet.json'))

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

let addresses = require(join(__dirname, `./../addresses/addresses/${network}.json`))

const provider = new ethers.providers.JsonRpcProvider( rpcUrls[network], {
  chainId: chainIds[network]
})
// 127.0.0.1:1337

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider)

// const logger = ora('Running deployer').start();

const deploy = async (name, { contractName, abi, bytecode }, params = []) => {
  const factory = new ethers.ContractFactory(abi, bytecode, signer)
  const contract = await factory.deploy(...params, { gasLimit: 21000000 })
  await write(`abis/${name}.js`, `export default ${JSON.stringify(abi)}`)
  addresses[name] = contract.address
  await contract.deployTransaction.wait()
  // logger.info(`${name}: deployed ${contractName} as ${contract.address}`)
  return contract
}

let contracts = {};
const date = new Date()
const year = date.getFullYear()
const month = date.getMonth()
const day = date.getDate()
const hours = date.getHours()
const minutes = date.getMinutes()
const seconds = date.getSeconds()
const UTCDate = Math.round(Math.round(new Date().getTime()) / 1000)
console.log(UTCDate);
const update = async () => {
  if (addresses.lotteryProxy && addresses.lottery) {
    const contract = new ethers.Contract(addresses.lotteryProxy, LOTTERY.abi, signer)
    const startTime = UTCDate + 60
    const endTime = UTCDate + 120 // 2 hours
    const prizePool = ethers.utils.parseUnits('100000', 18) // 10000 Art
    const ticketPrice = ethers.utils.parseUnits('1000', 18) // 10 Art
    const distribution = [ethers.BigNumber.from('2'), ethers.BigNumber.from('3'), ethers.BigNumber.from('5'), ethers.BigNumber.from('10'), ethers.BigNumber.from('20'), ethers.BigNumber.from('40')];
    try {
      await contract.createLottery(startTime, endTime, prizePool, ticketPrice, distribution)
      // logger.info(`created lottery`)
    } catch (e) {
      console.warn(e);
      // logger.info(e)
    } finally {

    }

  }
  // if (addresses.proxyManager) contracts.proxyManager = new ethers.Contract(addresses.proxyManager, PROXY_MANAGER, signer)


}

update()
