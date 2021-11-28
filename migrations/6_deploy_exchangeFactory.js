const ArtOnlineAccess = artifacts.require('./contracts/bridger/ArtOnlineAccess.sol')
const ArtOnlineBridger = artifacts.require('./contracts/bridger/ArtOnlineBridger.sol')
const ArtOnlinePlatform = artifacts.require("./contracts/token/ArtOnlinePlatform.sol");
const ArtOnlineMining = artifacts.require("./contracts/token/ArtOnlineMining.sol");
const ArtOnlineBlacklist = artifacts.require("./contracts/control/ArtOnlineBlacklist.sol");

const ArtOnline = artifacts.require("./contracts/token/ArtOnline.sol");
const ArtOnlineExchange = artifacts.require("./contracts/exchange/ArtOnlineExchange.sol");
const ArtOnlineStaking = artifacts.require("./contracts/staking/ArtOnlineStaking.sol");
const ArtOnlineExchangeFactory = artifacts.require("./contracts/exchange/ArtOnlineExchangeFactory.sol");


const { execSync } = require('child_process')
const ethers = require('ethers')
const {writeFile} = require('fs');
const {promisify} = require('util');
const write = promisify(writeFile);

// const Crowdsale = artifacts.require('./contracts/presale/Crowdsale.sol');

const SixtySeconds = ethers.BigNumber.from('60')
const rewardRates = [
  ethers.utils.parseUnits(((153000 / 2.102e+7) * 50).toString(), 18),
  ethers.utils.parseUnits(((9600 / 3.154e+7) * 400).toString(), 18),
  ethers.utils.parseUnits(((25100 / 2.102e+7) * 250).toString(), 18),
  ethers.utils.parseUnits(((97000 / 2.102e+7) * 133).toString(), 18),
  ethers.utils.parseUnits(((2300 / 3.154e+7) * 1000).toString(), 18),
  ethers.BigNumber.from('1'),
  ethers.utils.parseUnits(((143000 / 2.102e+7) * 50).toString(), 18),
]

const halvings = [
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('2340000'),
  ethers.BigNumber.from('1700000'),
]

module.exports = async (deployer, network) => {
  let addresses = {
  };

  addresses = require(`./../addresses/addresses/${network.replace('-fork', '')}.json`);
  // Ah fuck sakes ofc
  const updateContract = async (property, location, contract, isCard) => {
    if (network === 'mainnet' || network === 'ropsten' || network === 'art-ganache' ||
        network === 'goerli' || network === 'mango' ||
        network === 'polygon-mumbai' || network === 'polygon-mainnet' || network === 'binance-smartchain-testnet'  || network === 'binance-smartchain') {
          if (isCard) addresses.cards[property] = contract.address
          else addresses[property] = contract.address;

          if (location) await write(location, `export default ${JSON.stringify(contract.abi, null, '\t')}`)
      }
  }
  // if (network === 'goerli') {
  //   await deployer.deploy(ArteonV2, 'https://nft.arteon.org');
  //   await ArteonV2.deployed()
  // } else if (network === 'polygon-mumbai') {
  //   await deployer.deploy(ArteonV2Child, 'https://nft.arteon.org', '0xb5505a6d998549090530911180f38aC5130101c6');
  //   await ArteonV2Child.deployed()
  // }
  if (network === 'binance-smartchain-testnet'  || network === 'binance-smartchain' || network === 'art-ganache') {

    if (!addresses.exchangeFactory || addresses.exchangeFactory === 'undefined') {
      await deployer.deploy(ArtOnlineExchangeFactory)
      let artOnlineExchangeFactory = await ArtOnlineExchangeFactory.deployed()
      await updateContract('exchangeFactory', `abis/exchangeFactory.js`, artOnlineExchangeFactory)
    }

    const _addresses = `{
  "access": "${addresses.access}",
  "bridger": "${addresses.bridger}",
  "mining": "${addresses.mining}",
  "blacklist": "${addresses.blacklist}",
  "artonline": "${addresses.artonline}",
  "platform": "${addresses.platform}",
  "exchange": "${addresses.exchange}",
  "exchangeFactory": "${addresses.exchangeFactory}",
  "staking": "${addresses.staking}",
  "native": "${addresses.native}",
  "panCakeRouter": "${addresses.panCakeRouter}",
  "multiCall": "${addresses.multiCall}"
}`

    await Promise.all(
    [
      write(`addresses/addresses/${network}.js`, `export default ${_addresses}`),
      write(`addresses/addresses/${network}.json`, _addresses)
    ]
    )
  }

};
