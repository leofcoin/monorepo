const ArtOnlineBridger = artifacts.require('./contracts/bridger/ArtOnlineBridger.sol')
const ArtOnlinePlatform = artifacts.require("./contracts/token/ArtOnlinePlatform.sol");
const ArtOnlineMining = artifacts.require("./contracts/token/ArtOnlineMining.sol");
const ArtOnlineExchange = artifacts.require("./contracts/exchange/ArtOnlineExchange.sol");
const ethers = require('ethers')

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
  if (network === 'binance-smartchain-testnet'  || network === 'binance-smartchain' || network === 'art-ganache') {

    const MINT_ROLE = '0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686'
    const artOnlineBridger = await ArtOnlineBridger.deployed()
    const artOnlinePlatform = await ArtOnlinePlatform.deployed()
    const artOnlineMining = await ArtOnlineMining.deployed()
    const artOnlineExchange = await ArtOnlineExchange.deployed()

    // bridger.setArtOnlineAccess(addresses.access)
    await artOnlineBridger.setArtOnline(addresses.artonline)
    await artOnlineBridger.setArtOnlinePlatform(addresses.platform)
    await artOnlineBridger.setArtOnlineMining(addresses.mining)
    await artOnlineBridger.setArtOnlineBlacklist(addresses.blacklist)
    await artOnlineBridger.setArtOnlineExchange(addresses.exchange)
    await artOnlineBridger.setArtOnlineStaking(addresses.staking)

    await artOnlinePlatform.setArtOnlineBridgerInterface(addresses.bridger);
    await artOnlineMining.setArtOnlineBridgerInterface(addresses.bridger);

    // await artOnlinePlatformProxy.setDelegate(ArtOnlinePlatform.address)
    // await artOnlinePlatformProxy.setArtOnlineExchange(addresses.exchange)
    // await artOnlinePlatform.setArtOnline(addresses.artonline)
    // await artOnlinePlatform.setArtOnlineExchange(addresses.exchange)
    // await artOnlineProxy.setDelegate(artOnline.address)
    // await artOnlinePlatformProxy.setDelegate(artOnlinePlatform.address)

    await artOnlinePlatform.addToken('GENESIS', ethers.BigNumber.from('50'))
    await artOnlineMining.addPool('GENESIS', ethers.BigNumber.from('0'), rewardRates[0], halvings[0], addresses.artonline)

    await artOnlinePlatform.addToken('ARTX1000', ethers.BigNumber.from('400'))
    await artOnlineMining.addPool('ARTX1000', ethers.BigNumber.from('1'), rewardRates[1], halvings[1], addresses.artonline)

    await artOnlinePlatform.addToken('ARTX2000', ethers.BigNumber.from('250'))
    await artOnlineMining.addPool('ARTX2000', ethers.BigNumber.from('2'), rewardRates[2], halvings[2], addresses.artonline)

    await artOnlinePlatform.addToken('XTREME', ethers.BigNumber.from('133'))
    await artOnlineMining.addPool('XTREME', ethers.BigNumber.from('3'), rewardRates[3], halvings[3], addresses.artonline)

    await artOnlinePlatform.addToken('MODULE', ethers.BigNumber.from('1000'))
    await artOnlineMining.addPool('MODULE', ethers.BigNumber.from('4'), rewardRates[4], halvings[4], addresses.artonline)

    await artOnlinePlatform.addToken('SPINNER', ethers.BigNumber.from('500'))
    await artOnlineMining.addItem('SPINNER', ethers.BigNumber.from('5'), rewardRates[5], halvings[5], addresses.artonline)

    await artOnlinePlatform.addToken('GOLDGEN', ethers.BigNumber.from('50'))
    await artOnlineMining.addPool('GOLDGEN', ethers.BigNumber.from('6'), rewardRates[6], halvings[6], addresses.artonline)

    await artOnlineMining.setActivationPrice(ethers.BigNumber.from('5'), ethers.utils.parseUnits('3500', 18))

    await artOnlineExchange.list(ethers.BigNumber.from('0'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('153000', 18))
    await artOnlineExchange.list(ethers.BigNumber.from('1'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('9600', 18))
    await artOnlineExchange.list(ethers.BigNumber.from('2'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('50500', 18))
    await artOnlineExchange.list(ethers.BigNumber.from('3'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('110000', 18))
    await artOnlineExchange.list(ethers.BigNumber.from('4'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('7000', 18))

    await artOnlineExchange.list(ethers.BigNumber.from('5'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('10000', 18))
    await artOnlineExchange.list(ethers.BigNumber.from('6'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('320000', 18))

    // await artOnlinePlatform.grantRole(MINT_ROLE, artOnlinePlatform.address)

    // await updateContract('artonline', `abis/artonline.js`, artOnline)

    // await deployer.deploy(Crowdsale, '43478', '0xF52D485Eceba4049e92b66df0Ce60fE19589a0C1', artOnline.address)
    // const presale = await Crowdsale.deployed()

    // await artOnline.grantRole(MINT_ROLE, presale.address)
  }

};
