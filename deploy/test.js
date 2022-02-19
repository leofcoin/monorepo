const LOTTERY = require('./../build/contracts/ArtOnlineLottery.json');
const LOTTERY_TICKETS = require('./../build/contracts/LotteryTickets.json');
const RandomNumberGenerator = require('./../build/contracts/RandomNumberGenerator.json');
const ethers = require('ethers')
const {join} = require('path');
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

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider)
const contract = new ethers.Contract(addresses.lotteryProxy, LOTTERY.abi, signer);

contract.lotterySize().then(r => console.log(r))
// contract.setLotterySize(ethers.BigNumber.from('6')).then(async r => {
//   await r.wait()
//   const size = await contract.callStatic.lotterySize()
//   console.log(size);
// })
