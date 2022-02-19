const ArtOnline = artifacts.require("./contracts/token/ArtOnline.sol");
const ArtOnlinePlatform = artifacts.require("./contracts/token/ArtOnlinePlatform.sol");
const ArtOnlineExchange = artifacts.require("./contracts/exchange/ArtOnlineExchange.sol");
const ArtOnlineStaking = artifacts.require("./contracts/staking/ArtOnlineStaking.sol");
const ArtOnlineExchangeFactory = artifacts.require("./contracts/exchange/ArtOnlineExchangeFactory.sol");
const ArtOnlineBridger = artifacts.require('./contracts/bridger/ArtOnlineBridger.sol')
const ArtOnlineAccess = artifacts.require('./contracts/bridger/ArtOnlineAccess.sol')

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
  ethers.BigNumber.from('3.156e+7'), //1 year
  ethers.BigNumber.from('3.156e+7'),
  ethers.BigNumber.from('3.156e+7'),
  ethers.BigNumber.from('3.156e+7'),
  ethers.BigNumber.from('3.156e+7'),
  ethers.BigNumber.from('9.467e+7'), // 3 years
  ethers.BigNumber.from('3.156e+7'),
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
          console.log(contract.address);

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

    const MINT_ROLE = '0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686'
    // await deployer.deploy(ArtOnlineProxy);
    // let artOnlineProxy = await ArtOnlineProxy.deployed()
    // await updateContract('proxy', `abis/proxy.js`, artOnlineProxy)

    // await deployer.deploy(ArtOnlinePlatformProxy);
    // let artOnlinePlatformProxy = await ArtOnlinePlatformProxy.deployed()
    // await updateContract('platformProxy', `abis/platformProxy.js`, artOnlinePlatformProxy)
    let artOnlinePlatform
    if (!addresses.platform) {
      await deployer.deploy(ArtOnlinePlatform, 'https://nft.arteon.org/json/{id}.json', 'ArtOnline Platform', 'V2');
      artOnlinePlatform = await ArtOnlinePlatform.deployed()
      await updateContract('platform', `abis/platform.js`, artOnlinePlatform)
    }

    // if (!addresses.platformProxy) {
    //   const artOnlinePlatformProxy = await deployProxy(ArtOnlinePlatform, 'https://nft.arteon.org/json/{id}.json', 'ArtOnline Platform', 'V2', { deployer })
    //   await updateContract('platformProxy', `abis/platformProxy.js`, artOnlinePlatformProxy)
    // } else {
    //   const artOnlinePlatformProxy = await upgradeProxy(addresses.artOnlinePlatform, ArtOnlinePlatform, 'https://nft.arteon.org/json/{id}.json', { deployer })
    //   await updateContract('platformProxy', `abis/platformProxy.js`, artOnlinePlatformProxy)
    // }
    let artOnline
    if (!addresses.artonline) {
      await deployer.deploy(ArtOnline, artOnlinePlatform.address, ethers.utils.parseUnits('70000000', 18))
      artOnline = await ArtOnline.deployed()
      if (network === 'art-ganache') {
        await artOnline.mint('0xF52D485Eceba4049e92b66df0Ce60fE19589a0C1', ethers.utils.parseUnits('10000000', 18))
      }
      await updateContract('artonline', `abis/artonline.js`, artOnline)
    } else {
      artOnline = await ArtOnline.deployed()
    }



    // await deployer.deploy(ArtOnlinePlatformProxy)
    // let artOnlinePlatformProxy = await ArtOnlinePlatformProxy.deployed()
    // await updateContract('platformProxy', `abis/platformProxy.js`, artOnlinePlatformProxy)
    let artOnlineExchange
    if (!addresses.exchange) {
      await deployer.deploy(ArtOnlineExchange)
      artOnlineExchange = await ArtOnlineExchange.deployed()
      await updateContract('exchange', `abis/exchange.js`, artOnlineExchange)
    }

    if (!addresses.exchangeFactory) {
      await deployer.deploy(ArtOnlineExchangeFactory)
      let artOnlineExchangeFactory = await ArtOnlineExchangeFactory.deployed()
      await updateContract('exchangeFactory', `abis/exchangeFactory.js`, artOnlineExchangeFactory)
    }

    if (!addresses.staking) {
      await deployer.deploy(ArtOnlineStaking, 'ArtOnlineStaking', 'ARTs')
      let artOnlineStaking = await ArtOnlineStaking.deployed()
      await updateContract('staking', `abis/staking.js`, artOnlineStaking)
    }

    // await artOnlinePlatformProxy.setDelegate(ArtOnlinePlatform.address)
    // await artOnlinePlatformProxy.setArtOnlineExchange(addresses.exchange)
    // await artOnlinePlatform.setArtOnline(addresses.artonline)
    // await artOnlinePlatform.setArtOnlineExchange(addresses.exchange)
    // await artOnlineProxy.setDelegate(artOnline.address)
    // await artOnlinePlatformProxy.setDelegate(artOnlinePlatform.address)

    await artOnlinePlatform.addToken('GENESIS', ethers.BigNumber.from('50'))
    await artOnlinePlatform.addPool(ethers.BigNumber.from('0'), rewardRates[0], halvings[0])

    await artOnlinePlatform.addToken('ARTX1000', ethers.BigNumber.from('400'))
    await artOnlinePlatform.addPool(ethers.BigNumber.from('1'), rewardRates[1], halvings[1])

    await artOnlinePlatform.addToken('ARTX2000', ethers.BigNumber.from('250'))
    await artOnlinePlatform.addPool(ethers.BigNumber.from('2'), rewardRates[2], halvings[2])

    await artOnlinePlatform.addToken('XTREME', ethers.BigNumber.from('133'))
    await artOnlinePlatform.addPool(ethers.BigNumber.from('3'), rewardRates[3], halvings[3])

    await artOnlinePlatform.addToken('MODULE', ethers.BigNumber.from('1000'))
    await artOnlinePlatform.addPool(ethers.BigNumber.from('4'), rewardRates[4], halvings[4])

    await artOnlinePlatform.addToken('SPINNER', ethers.BigNumber.from('500'))
    await artOnlinePlatform.addItem(ethers.BigNumber.from('5'), rewardRates[5], halvings[5])

    await artOnlinePlatform.addToken('GOLDGEN', ethers.BigNumber.from('50'))
    await artOnlinePlatform.addPool(ethers.BigNumber.from('6'), rewardRates[6], halvings[6])

    await artOnlinePlatform.setActivationPrice(ethers.BigNumber.from('5'), ethers.utils.parseUnits('3500', 18))

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

    // await updateContract('presale', `abis/presale.js`, presale)

    const _addresses = `{
  "artonline": "${addresses.artonline}",
  "platform": "${addresses.platform}",
  "exchange": "${addresses.exchange}",
  "staking": "${addresses.staking}",
  "native": "${addresses.native}",
  "panCakeRouter": "${addresses.panCakeRouter}"
}`

    await Promise.all(
    [
      write(`addresses/addresses/${network}.js`, `export default ${_addresses}`),
      write(`addresses/addresses/${network}.json`, _addresses)
    ]
    )
    return
  } else if (network === 'polygon-mumbai') {
    // await deployer.deploy(Arteon, 'Arteon', 'ART');
    // const token = await Arteon.deployed()
    await deployer.deploy(ArteonL1L2Child, 'https://nft.arteon.org/json/{id}.json');
    const token = await ArteonL1L2Child.deployed()
  }
  // await deployer.deploy(ArteonV2, 'https://nft.arteon.org', 'Arteon', 'ART');

return
  // 70M

//
  if (!addresses.token && !network.includes('fork')) {
    let token
    if (network === 'polygon-mumbai') {
      // polygon mined ART
      await deployer.deploy(MinedArteonChild, 'PolygonMinedArteon', 'pmART', supplyCap)
      token = await MinedArteonChild.deployed()
      // TODO: remove for mainnet
    } else if (network === 'goerli') {
      await deployer.deploy(MinedArteon, 'MinedArteon', 'mART', supplyCap)
      token = await MinedArteon.deployed()
    } else {
      await deployer.deploy(Arteon, 'Arteon', 'ART');
      token = await Arteon.deployed()
    }


    if (network === 'mainnet' || network === 'ropsten' || network === 'goerli' ||
        network === 'polygon-mumbai' || network === 'polygon-mainnet') {
      addresses.token = token.address
    }
    if (network === 'mainnet') {
      await write(`mine/src/abis/arteon.js`, `export default ${JSON.stringify(token.abi, null, '\t')}`)
    } else {
      await write(`mine/src/abis/mined-arteon.js`, `export default ${JSON.stringify(token.abi, null, '\t')}`)
    }
  }

  if (!addresses.exchange && !network.includes('fork')) {
    await deployer.deploy(ArteonExchange, addresses.token);
    const arteonExchange = await ArteonExchange.deployed();
    updateContract('exchange', `mine/src/abis/exchange.js`, arteonExchange)
  }

  if (!addresses.cards.genesis && !network.includes('fork')) {
    await deployer.deploy(ArteonGPUGenesis);
    const Genesis = await ArteonGPUGenesis.deployed()
    updateContract('genesis', 'mine/src/abis/gpu.js', Genesis, true)
  }

  if (!addresses.cards.artx1000 && !network.includes('fork')) {
    await deployer.deploy(ArteonGPUARTX1000);
    const ARTX1000 = await ArteonGPUARTX1000.deployed()
    updateContract('artx1000', null, ARTX1000, true)
  }

  if (!addresses.cards.artx2000 && !network.includes('fork')) {
    await deployer.deploy(ArteonGPUARTX2000);
    const ARTX2000 = await ArteonGPUARTX2000.deployed()

    updateContract('artx2000', null, ARTX2000, true)
  }

  if (!addresses.cards.xtreme && !network.includes('fork')) {
    await deployer.deploy(ArteonGPUXTREME);
    const XTREME = await ArteonGPUXTREME.deployed()
    updateContract('xtreme', null, XTREME, true)
  }

  if (!addresses.factory && !network.includes('fork')) {
    await deployer.deploy(ArteonPoolFactory);
    const factory = await ArteonPoolFactory.deployed();
    await updateContract('factory', `mine/src/abis/pool.js`, factory)

    await factory.addToken(addresses.cards.genesis, addresses.token, SixtySeconds, rewardRates[0], halvings[0]);
    await factory.addToken(addresses.cards.artx1000, addresses.token, SixtySeconds, rewardRates[1], halvings[1]);
    await factory.addToken(addresses.cards.artx2000, addresses.token, SixtySeconds, rewardRates[2], halvings[2]);
    await factory.addToken(addresses.cards.xtreme, addresses.token, SixtySeconds, rewardRates[3], halvings[3]);

  }

  if (network === 'ropsten' || network === 'kovan' || network === 'wapnet' ||
      network === 'mainnet' || network === 'polygon-mumbai' ||
      network === 'polygon-mainnet') {

      const _addresses = `{
  "token": "${addresses.token}",
  "exchange": "${addresses.exchange}",
  "factory": "${addresses.factory}",
  "cards": {
    "genesis": "${addresses.cards.genesis}",
    "artx1000": "${addresses.cards.artx1000}",
    "artx2000": "${addresses.cards.artx2000}",
    "xtreme": "${addresses.cards.xtreme}"
  }
}`


    await Promise.all(
      [
        write(`addresses/addresses/${network}.js`, `export default ${_addresses}`),
        write(`addresses/addresses/${network}.json`, _addresses)
      ]
    )

    // const pools = [
    //   GenesisPool.address,
    //   ArteonPoolARTX1000.address,
    //   ArteonPoolARTX2000.address
    // ]
    //
    // let promises = []
    //
    // for (const pool of pools) {
    //   promises.push(token.minters(pool))
    // }
    //
    // promises = await Promise.all(promises)
    //
    // promises = promises.reduce((prev, current, i) => {
    //   if (!current) prev.push(token.addMinter(pools[i]))
    //   return prev
    // }, [])
    //
    // promises = await Promise.all(promises)

    let flats = [
      execSync('truffle-flattener contracts/pools/ArteonPoolFactory.sol'),
      execSync('truffle-flattener contracts/gpus/ArteonGPUGenesis.sol'),
      execSync('truffle-flattener contracts/exchange/ArteonExchange.sol'),
      execSync('truffle-flattener contracts/miner/ArteonMiner.sol'),
      execSync('truffle-flattener contracts/token/Arteon.sol')
    ]

    await Promise.all(flats)

    flats = flats.map(flat => flat.toString()
      .replace(/\/\/ SPDX-License-Identifier: MIT/g, '')
      .replace(/\/\/ File: (.*)\s\s/g, '')
      .replace(/pragma solidity (.*)\s/g, ''))

    const writeFlats = [
      write(`build/flats/ArteonPoolGenesis.sol`, flats[0]),
      write(`build/flats/ArteonGPUGenesis.sol`, flats[1]),
      write(`build/flats/ArteonExchange.sol`, flats[2]),
      write(`build/flats/ArteonMiner.sol`, flats[3]),
      write(`build/flats/Arteon.sol`, flats[4])
    ]
    await Promise.all(writeFlats)
    // console.log({
    //   token: token.address,
    //   exchange: arteonExchange.address,
    //   pools: {
    //     genesis: GenesisPool.address,
    //     artx1000: ARTX1000Pool.address,
    //     artx2000: ARTX2000Pool.address
    //   },
    //   poolContracts: {
    //     genesis: GENESISContract,
    //     artx1000: ARTX1000Contract,
    //     artx2000: ARTX2000Contract
    //   },
    //   cards: {
    //     genesis: Genesis.address,
    //     artx1000: ARTX1000.address,
    //     artx2000: ARTX2000.address
    //   }
    // });
  }

};
