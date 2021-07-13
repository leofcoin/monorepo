const Arteon = artifacts.require("./contracts/token/Arteon.sol");

const ArteonGPUGenesis = artifacts.require("./contracts/gpus/ArteonGPUGenesis.sol");
const ArteonGPUARTX1000 = artifacts.require("./contracts/gpus/ArteonGPUARTX1000.sol");
const ArteonGPUARTX2000 = artifacts.require("./contracts/gpus/ArteonGPUARTX2000.sol");

const ArteonPoolFactory = artifacts.require("./contracts/pools/ArteonPoolFactory.sol");
const ArteonExchange = artifacts.require("./contracts/exchange/ArteonExchange.sol");

const { execSync } = require('child_process')
const ethers = require('ethers')
const {writeFile} = require('fs');
const {promisify} = require('util');
const write = promisify(writeFile);

const SixtySeconds = ethers.BigNumber.from('60')
const rewardRates = [
  ethers.utils.parseUnits(((153000 / 2.102e+7) * 50).toString(), 18),
  ethers.utils.parseUnits(((9600 / 3.154e+7) * 400).toString(), 18),
  ethers.utils.parseUnits(((25100 / 2.102e+7) * 250).toString(), 18)
]

const halvings = [
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000')
]

module.exports = async (deployer, network) => {
  let addresses = {
    pools: {

    },
    cards: {

    },
    poolContracts: {

    }
  };

  addresses = require(`./../addresses/addresses/${network.replace('-fork', '')}.json`);

  if (!addresses.token && !network.includes('fork')) {
    await deployer.deploy(Arteon, 'Arteon', 'ART');
    const token = await Arteon.deployed()
    if (network === 'mainnet' || network === 'ropsten') {
      addresses.token = token.address
    }
    await write(`mine/src/abis/arteon.js`, `export default ${JSON.stringify(token.abi, null, '\t')}`)
  }

  if (!addresses.exchange && !network.includes('fork')) {
    await deployer.deploy(ArteonExchange, addresses.token);
    const arteonExchange = await ArteonExchange.deployed();
    if (network === 'mainnet' || network === 'ropsten') {
      addresses.exchange = arteonExchange.address
    }
    await write(`mine/src/abis/exchange.js`, `export default ${JSON.stringify(arteonExchange.abi, null, '\t')}`)
  }

  if (!addresses.cards.genesis && !network.includes('fork')) {
    await deployer.deploy(ArteonGPUGenesis);
    const Genesis = await ArteonGPUGenesis.deployed()
    if (network === 'mainnet' || network === 'ropsten') {
      addresses.cards.genesis = Genesis.address
    }
    write(`mine/src/abis/gpu.js`, `export default ${JSON.stringify(Genesis.abi, null, '\t')}`)
  }

  if (!addresses.cards.artx1000 && !network.includes('fork')) {
    await deployer.deploy(ArteonGPUARTX1000);
    const ARTX1000 = await ArteonGPUARTX1000.deployed()
    if (network === 'mainnet' || network === 'ropsten') {
      addresses.cards.artx1000 = ARTX1000.address
    }
  }

  if (!addresses.cards.artx1000 && !network.includes('fork')) {
    await deployer.deploy(ArteonGPUARTX2000);
    const ARTX2000 = await ArteonGPUARTX2000.deployed()
    if (network === 'mainnet' || network === 'ropsten') {
      addresses.cards.artx2000 = ARTX2000.address
    }
  }

  if (!addresses.factory && !network.includes('fork')) {
    await deployer.deploy(ArteonPoolFactory);
    const factory = await ArteonPoolFactory.deployed();
    if (network === 'mainnet' || network === 'ropsten') {
      addresses.factory = factory.address
    }
    await factory.addToken(addresses.cards.genesis, addresses.token, SixtySeconds, rewardRates[0], halvings[0]);
    await factory.addToken(addresses.cards.artx1000, addresses.token, SixtySeconds, rewardRates[1], halvings[1]);
    await factory.addToken(addresses.cards.artx2000, addresses.token, SixtySeconds, rewardRates[2], halvings[2]);
    write(`mine/src/abis/pool.js`, `export default ${JSON.stringify(factory.abi, null, '\t')}`)
  }

  if (network === 'ropsten' || network === 'kovan' || network === 'wapnet' || network === 'mainnet') {

      const _addresses = `{
  "token": "${addresses.token}",
  "exchange": "${addresses.exchange}",
  "factory": "${addresses.factory}",
  "cards": {
    "genesis": "${addresses.cards.genesis}",
    "artx1000": "${addresses.cards.artx1000}",
    "artx2000": "${addresses.cards.artx2000}"
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

    // let flats = await Promise.all([
    //   execSync('truffle-flattener contracts/pools/ArteonPoolFactory.sol'),
    //   execSync('truffle-flattener contracts/gpus/ArteonGPUGenesis.sol'),
    //   execSync('truffle-flattener contracts/exchange/ArteonExchange.sol'),
    //   execSync('truffle-flattener contracts/miner/ArteonMiner.sol'),
    // ])
    //
    // flats = flats.map(flat => flat.toString()
    //   .replace(/\/\/ SPDX-License-Identifier: MIT/g, '')
    //   .replace(/\/\/ File: (.*)\s\s/g, '')
    //   .replace(/pragma solidity (.*)\s/g, ''))
    //
    // await Promise.all([
    //   write(`build/flats/ArteonPoolGenesis.sol`, flats[0]),
    //   write(`build/flats/ArteonGPUGenesis.sol`, flats[1]),
    //   write(`build/flats/ArteonExchange.sol`, flats[2]),
    //   write(`build/flats/ArteonMiner.sol`, flats[3])
    // ])
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
