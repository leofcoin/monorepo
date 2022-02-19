const ACCESS_ABI = require('./../build/contracts/ArtOnlineAccess.json');
const BRIDGER_ABI = require('./../build/contracts/ArtOnlineBridger.json');
const ARTONLINE_ABI = require('./../build/contracts/ArtOnline.json');
const PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json');
const MINING_ABI = require('./../build/contracts/ArtOnlineMining.json');
const EXCHANGE_ABI = require('./../build/contracts/ArtOnlineExchange.json');
const EXCHANGE_FACTORY_ABI = require('./../build/contracts/ArtOnlineExchangeFactory.json');
const STAKING_ABI = require('./../build/contracts/ArtOnlineStaking.json');
const SPLITTER_ABI = require('./../build/contracts/ArtOnlineSplitter.json');
const BLACKLIST_ABI = require('./../build/contracts/ArtOnlineBlacklist.json');
const PartnershipToken = require('./../build/contracts/PartnershipToken.json')
const ArtOnlinePoolPartner = require('./../build/contracts/ArtOnlinePoolPartner.json')

const ethers = require('ethers')
const { join } = require('path')
const { writeFile } = require('fs')
const { promisify } = require('util')
const write = promisify(writeFile)

module.exports = async (addresses, signer, logger, network) => {
  if (!logger) {
    const ora = require('ora');
    logger = ora('Deploying contracts').start();
  } else {
    logger.start('Deploying contracts')
  }

  const deploy = async (name, { contractName, abi, bytecode }, params = []) => {
    const factory = new ethers.ContractFactory(abi, bytecode, signer)
    const contract = await factory.deploy(...params, { gasLimit: 21000000 })
    await write(`abis/${name}.js`, `export default ${JSON.stringify(abi)}`)
    addresses[name] = contract.address
    await contract.deployTransaction.wait()
    logger.info(`${name}: deployed ${contractName} as ${contract.address}`)
    return contract
  }

  // await deploy('access', ACCESS_ABI)
  // await deploy('bridger', BRIDGER_ABI, [addresses.access])
  await deploy('mining', MINING_ABI, ['ArtOnline Mining', 'V2', addresses.bridger, addresses.access])
  await deploy('platform', PLATFORM_ABI, ['https://nfts.artonline.site/', 'ArtOnline Platform', 'V2', addresses.bridger, addresses.access])
  // await deploy('artonline', ARTONLINE_ABI, [addresses.platform, ethers.utils.parseUnits('70000000')])
  // await deploy('staking', STAKING_ABI, [addresses.bridger, addresses.access])
  await deploy('exchangeFactory', EXCHANGE_FACTORY_ABI, ['ArtOnlineExchangeFactory', 'V2'])
  // await deploy('exchange', EXCHANGE_ABI, [])
  // await deploy('blacklist', BLACKLIST_ABI, [addresses.access])

  // await deploy('partnershipToken', PartnershipToken, [])
  // await deploy('splitter', SPLITTER_ABI, [addresses.bridger, addresses.access])
  // await deploy('partnerPool', ArtOnlinePoolPartner, ['PartnershipToken', addresses.partnershipToken, addresses.bridger, addresses.access])

  // write new addresses
  await write(join(__dirname, `./../addresses/addresses/${network}.json`), `${JSON.stringify(addresses, null, 2)}`)
  await write(join(__dirname, `./../addresses/addresses/${network}.js`), `export default ${JSON.stringify(addresses, null, 2)}`)
  logger.succeed('Contracts deployed')

  return addresses
}
