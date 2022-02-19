const BRIDGER_ABI = require('./../build/contracts/ArtOnlineBridger.json');
const PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json');
const MINING_ABI = require('./../build/contracts/ArtOnlineMining.json');
const EXCHANGE_ABI = require('./../build/contracts/ArtOnlineExchange.json');
const EXCHANGE_FACTORY_ABI = require('./../build/contracts/ArtOnlineExchangeFactory.json');
const STAKING_ABI = require('./../build/contracts/ArtOnlineStaking.json');
const ACCESS_ABI = require('./../build/contracts/ArtOnlineAccess.json');
const ARTONLINE_ABI = require('./../build/contracts/ArtOnline.json');
const SPLITTER_ABI = require('./../build/contracts/ArtOnlineSplitter.json');
const PartnershipToken = require('./../build/contracts/PartnershipToken.json')
const ArtOnlinePoolPartner = require('./../build/contracts/ArtOnlinePoolPartner.json')

const ethers = require('ethers')

const SixtySeconds = ethers.BigNumber.from('60')
const TAX = ethers.BigNumber.from('20')

const rewardRates = [
  ethers.utils.parseUnits(((153000 / 2.102e+7) * 50).toString(), 18),
  ethers.utils.parseUnits(((9600 / 3.154e+7) * 400).toString(), 18),
  ethers.utils.parseUnits(((25100 / 2.102e+7) * 250).toString(), 18),
  ethers.utils.parseUnits(((97000 / 2.102e+7) * 133).toString(), 18),
  ethers.utils.parseUnits(((2300 / 3.154e+7) * 1000).toString(), 18),
  ethers.BigNumber.from('1'),
  ethers.utils.parseUnits(((128000 / 1.577e+7) * 45).toString(), 18),
  ethers.utils.parseUnits(((68700 / 1.577e+7) * 100).toString(), 18), // shiboki
]

const halvings = [
  ethers.BigNumber.from(3.154e+7), // genesis
  ethers.BigNumber.from(3.154e+7), // ARTX1000
  ethers.BigNumber.from(3.154e+7), // ARTX2000
  ethers.BigNumber.from(3.154e+7), // extreme
  ethers.BigNumber.from(3.154e+7), // module
  ethers.BigNumber.from(9.461e+7), // spinner
  ethers.BigNumber.from(3.154e+7), // goldgen
  ethers.BigNumber.from(3.154e+7)  // shiboki
]

module.exports = async (addresses, signer, logger) => {
  if (!logger) {
    const ora = require('ora');
    logger = ora('Setting up new contracts').start();
  } else {
    logger.start('Setting up new contracts')
  }
  const MINT_ROLE = '0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686'
  const artOnlineBridger = await new ethers.Contract(addresses.bridger, BRIDGER_ABI.abi, signer)
  const artOnlinePlatform = await new ethers.Contract(addresses.platform, PLATFORM_ABI.abi, signer)
  const artOnlineMining = await new ethers.Contract(addresses.mining, MINING_ABI.abi, signer)
  const artOnlineExchange = await new ethers.Contract(addresses.exchange, EXCHANGE_ABI.abi, signer)
  const artOnlineExchangeFactory = await new ethers.Contract(addresses.exchangeFactory, EXCHANGE_FACTORY_ABI.abi, signer)
  const artOnlineStaking = await new ethers.Contract(addresses.staking, STAKING_ABI.abi, signer)
  const artOnlineAccess = await new ethers.Contract(addresses.access, ACCESS_ABI.abi, signer)
  const artOnline = await new ethers.Contract(addresses.artonline, ARTONLINE_ABI.abi, signer)


  // logger.start('grant roles')
  let tx
  // await artOnlineStaking.setReleaseTime(ethers.BigNumber.from('15770000'))
  // tx = await artOnline.grantRole(MINT_ROLE, addresses.exchange)
  // // await tx.wait()
  // tx = await artOnline.grantRole(MINT_ROLE, addresses.mining)
  // await tx.wait()
  tx = await artOnline.grantRole(MINT_ROLE, addresses.staking)
  await tx.wait()
  // //
  // // // tx = await partnershipToken.grantRole(MINT_ROLE, addresses.mining)
  // // // await tx.wait()
  // // // tx = await partnershipToken.grantRole(MINT_ROLE, addresses.platform)
  // // // await tx.wait()
  // //
  // // // tx = await partnershipToken.grantRole(MINT_ROLE, addresses.partnerPool)
  // // // await tx.wait()
  // //
  // tx = await artOnlineAccess.grantRole(MINT_ROLE, addresses.platform)
  // await tx.wait()
  // // tx = await artOnlineAccess.grantRole(MINT_ROLE, addresses.staking)
  // // await tx.wait()
  // tx = await artOnlineAccess.grantRole(MINT_ROLE, addresses.mining)
  // await tx.wait()
  // // // bridger.setArtOnlineAccess(addresses.access)
  // // logger.succeed('Roles granted')
  // // logger.start('Update Bridger')
  // //
  // // tx = await artOnlineBridger.setArtOnline(addresses.artonline, {gasLimit: 21000000})
  // // await tx.wait()
  // // logger.info('setArtOnline')
  // //
  // tx = await artOnlineBridger.setArtOnlinePlatform(addresses.platform)
  // await tx.wait()
  // logger.info('setArtOnlinePlatform')
  // //
  // tx = await artOnlineBridger.setArtOnlineMining(addresses.mining)
  // await tx.wait()
  // logger.info('setArtOnlineMining')
  // //
  // // tx = await artOnlineBridger.setArtOnlineBlacklist(addresses.blacklist)
  // // await tx.wait()
  // // logger.info('setArtOnlineBlacklist')
  // //
  // // tx = await artOnlineBridger.setArtOnlineExchange(addresses.exchange)
  // // await tx.wait()
  // // logger.info('setArtOnlineExchange')
  // //
  // // tx = await artOnlineBridger.setArtOnlineStaking(addresses.staking)
  // // await tx.wait()
  // // logger.info('setArtOnlineStaking')
  // //
  // tx = await artOnlineBridger.setArtOnlineExchangeFactory(addresses.exchangeFactory)
  // await tx.wait()
  // logger.info('setArtOnlineExchangeFactory')
  // //
  // logger.succeed('Bridger updated')
  // logger.start('Set bridgerInterfaces')
  // //
  // // // tx = await partnerPool.setArtOnlineBridgerInterface(addresses.bridger);
  // // // await tx.wait()
  // tx = await artOnlinePlatform.setArtOnlineBridgerInterface(addresses.bridger);
  // await tx.wait()
  // tx = await artOnlineMining.setArtOnlineBridgerInterface(addresses.bridger);
  // await tx.wait()
  // tx = await artOnlineStaking.setArtOnlineBridgerInterface(addresses.bridger);
  // await tx.wait()
  // // tx = await artOnlineExchangeFactory.setArtOnlineBridgerInterface(addresses.bridger);
  // // await tx.wait()
  // tx = await artOnlineExchange.setArtOnlinePlatform(addresses.platform)
  // await tx.wait()
  // // tx = await artOnlineExchange.setArtOnlineStaking(addresses.staking)
  // // await tx.wait()
  // // tx = await artOnlineExchange.setArtOnline(addresses.artonline)
  // // await tx.wait()
  // logger.succeed()
  //
  //
  // logger.start('Set fee & feeReceiver')
  // tx = await artOnlineExchangeFactory.setFee(ethers.BigNumber.from('1'))
  // await tx.wait()
  // tx = await artOnlineExchangeFactory.setFeeReceiver(signer.address)
  // await tx.wait()
  //
  // logger.succeed()
  // logger.start('Add Tokens')
  // //
  // tx = await artOnlinePlatform.addToken('GENESIS', ethers.BigNumber.from('50'))
  // await tx.wait()
  // logger.info(`Added GENESIS`)
  //
  // tx = await artOnlinePlatform.addToken('ARTX1000', ethers.BigNumber.from('400'))
  // await tx.wait()
  // logger.info(`Added: ARTX1000`)
  //
  // tx = await artOnlinePlatform.addToken('ARTX2000', ethers.BigNumber.from('250'))
  // await tx.wait()
  // logger.info(`Added: ARTX2000`)
  //
  // tx = await artOnlinePlatform.addToken('XTREME', ethers.BigNumber.from('133'))
  // await tx.wait()
  // logger.info(`Added: XTREME`)
  //
  // tx = await artOnlinePlatform.addToken('MODULE', ethers.BigNumber.from('1000'))
  // await tx.wait()
  // logger.info(`Added: MODULE`)
  //
  // tx = await artOnlinePlatform.addToken('SPINNER', ethers.BigNumber.from('500'))
  // await tx.wait()
  // logger.info(`Added: SPINNER`)
  //
  // tx = await artOnlinePlatform.addToken('GOLDGEN', ethers.BigNumber.from('45'))
  // await tx.wait()
  // logger.info(`Added: GOLDGEN`)

  // await artOnlinePlatform.addToken('SHIBOKI', ethers.BigNumber.from('100'))
  // logger.info(`Added: SHIBOKI`)
  //
  // logger.succeed()
  // logger.start('Add Pools')
  // tx = await artOnlineMining.setTax(TAX)
  // await tx.wait()
  // tx = await artOnlineMining.addPool('GENESIS', ethers.BigNumber.from('0'), rewardRates[0], halvings[0], addresses.artonline)
  // await tx.wait()
  // tx = await artOnlineMining.addPool('ARTX1000', ethers.BigNumber.from('1'), rewardRates[1], halvings[1], addresses.artonline)
  // await tx.wait()
  // tx = await artOnlineMining.addPool('ARTX2000', ethers.BigNumber.from('2'), rewardRates[2], halvings[2], addresses.artonline)
  // await tx.wait()
  // tx = await artOnlineMining.addPool('XTREME', ethers.BigNumber.from('3'), rewardRates[3], halvings[3], addresses.artonline)
  // await tx.wait()
  // tx = await artOnlineMining.addPool('MODULE', ethers.BigNumber.from('4'), rewardRates[4], halvings[4], addresses.artonline)
  // await tx.wait()
  //
  // tx = await artOnlineMining.addItem('SPINNER', ethers.BigNumber.from('5'), rewardRates[5], halvings[5], addresses.artonline)
  // await tx.wait()
  //
  // tx = await artOnlineMining.addPool('GOLDGEN', ethers.BigNumber.from('6'), rewardRates[6], halvings[6], addresses.artonline)
  // await tx.wait()
  // // await artOnlineMining.addPool('SHIBOKI', ethers.BigNumber.from('7'), rewardRates[7], halvings[7], addresses.partnerPool, {gasLimit: 21000000})
  //
  // tx = await artOnlineMining.setActivationPrice(ethers.BigNumber.from('5'), ethers.utils.parseUnits('3500', 18))
  // await tx.wait()
  // logger.succeed()
  // logger.start('List gpus')
//   tx = await artOnlineExchange.list(ethers.BigNumber.from('0'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('153000', 18))
//   await tx.wait()
//
//   tx = await artOnlineExchange.list(ethers.BigNumber.from('1'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('9600', 18))
//   await tx.wait()
//   tx = await artOnlineExchange.list(ethers.BigNumber.from('2'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('50500', 18))
//   await tx.wait()
//
//   tx = await artOnlineExchange.list(ethers.BigNumber.from('3'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('110000', 18))
//   await tx.wait()
//   tx = await artOnlineExchange.list(ethers.BigNumber.from('4'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('7000', 18))
// await tx.wait()
//   tx = await artOnlineExchange.list(ethers.BigNumber.from('5'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('10000', 18))
//   await tx.wait()
  // await artOnlineExchange.list(ethers.BigNumber.from('6'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('320000', 18))

  // tx = await artOnlinePlatform._mintAssets(signer.address, 6, 10)
  // await tx.wait()

  // const value = {
  //   addresses: [],
  //   currencies: [],
  //   ids: [],
  //   prices: [],
  //   tokens: []
  // }
  // for (let i = 1; i <= 10; i++) {
  //   value.addresses.push(addresses.platform)
  //   value.currencies.push(addresses.artonline)
  //   value.ids.push(6)
  //   value.tokens.push(i)
  //   value.prices.push(ethers.utils.parseUnits('1'))
  // }
  // tx = await artOnlineExchangeFactory.createListingBatch(
  //   value.addresses,
  //   value.currencies,
  //   value.prices,
  //   value.ids,
  //   value.tokens
  // )
  // await tx.wait()

  logger.succeed()
  // await artOnlinePlatform.grantRole(MINT_ROLE, artOnlinePlatform.address)

  // await updateContract('artonline', `abis/artonline.js`, artOnline)

  // await deployer.deploy(Crowdsale, '43478', '0xF52D485Eceba4049e92b66df0Ce60fE19589a0C1', artOnline.address)
  // const presale = await Crowdsale.deployed()

  // await artOnline.grantRole(MINT_ROLE, presale.address)

}
