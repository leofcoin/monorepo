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
const gaming = require('./gaming')
const PROXY_MANAGER = require('./../build/contracts/ProxyManager.json');
const LOTTERY_TICKETS = require('./../build/contracts/LotteryTickets.json');
const LOTTERY = require('./../build/contracts/ArtOnlineLottery.json');
const ARTONLINE_ABI = require('./../build/contracts/ArtOnline.json');
const MINT_ROLE = '0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686'

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

const logger = ora('Running deployer').start();

const deploy = async (name, { contractName, abi, bytecode }, params = []) => {
  const factory = new ethers.ContractFactory(abi, bytecode, signer)
  const contract = await factory.deploy(...params, { gasLimit: 21000000 })
  await write(`abis/${name}.js`, `export default ${JSON.stringify(abi)}`)
  addresses[name] = contract.address
  await contract.deployTransaction.wait()
  logger.info(`${name}: deployed ${contractName} as ${contract.address}`)
  return contract
}

let contracts = {};

const update = async () => {
  if (addresses.proxyManager) contracts.proxyManager = new ethers.Contract(addresses.proxyManager, PROXY_MANAGER.abi, signer)
  // if (addresses.proxyManager) contracts.proxyManager = new ethers.Contract(addresses.proxyManager, PROXY_MANAGER, signer)
  let result
  result = await createables({deploy}, addresses, contracts, signer)
  result = await staking({deploy}, result.addresses, result.contracts, signer)
  result = await gaming({deploy}, result.addresses, result.contracts, signer)
  result = await lottery({deploy}, result.addresses, result.contracts, signer)

  result = await proxy({deploy}, result.addresses, result.contracts, signer)
  contract = new ethers.Contract(addresses.lotteryProxy, LOTTERY.abi, signer);
  // let tx = await contract.initialize()
  // await tx.wait()
  // // let tx = await contract.changeManager(signer.address)
  // // await tx.wait()
  //
  // let tx = await contract.setMaxRange(ethers.BigNumber.from('9'))
  // await tx.wait()
  // tx = await contract.changeLotteryTicketsNFT(addresses.lotteryTickets)
  // await tx.wait()
  // tx = await contract.changeArtOnline(addresses.artonline)
  // await tx.wait()
  // tx = await contract.setLotterySize(ethers.BigNumber.from('6'))
  // await tx.wait()
  // contract = new ethers.Contract(addresses.artonline, ARTONLINE_ABI.abi, signer);
  // tx = await contract.grantRole(MINT_ROLE, addresses.lotteryProxy)
  // await tx.wait()
  await write(join(__dirname, `./../addresses/addresses/${network}.json`), `${JSON.stringify(result.addresses, null, 2)}`)
  await write(join(__dirname, `./../addresses/addresses/${network}.js`), `export default ${JSON.stringify(result.addresses, null, 2)}`)
}

update()
