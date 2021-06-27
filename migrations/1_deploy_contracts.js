const Arteon = artifacts.require("./contracts/token/Arteon.sol");

const ArteonGPUGenesis = artifacts.require("./contracts/gpus/ArteonGPUGenesis.sol");
const ArteonGPUARTX1000 = artifacts.require("./contracts/gpus/ArteonGPUARTX1000.sol");
const ArteonGPUARTX2000 = artifacts.require("./contracts/gpus/ArteonGPUARTX2000.sol");

const ArteonPoolGenesis = artifacts.require("./contracts/pools/ArteonPoolGenesis.sol");
const ArteonPoolARTX1000 = artifacts.require("./contracts/pools/ArteonPoolARTX1000.sol");
const ArteonPoolARTX2000 = artifacts.require("./contracts/pools/ArteonPoolARTX2000.sol");
const ArteonExchange = artifacts.require("./contracts/exchange/ArteonExchange.sol");

const { execSync } = require('child_process')
const ethers = require('ethers')
const {writeFile} = require('fs');
const {promisify} = require('util');
const write = promisify(writeFile);

const SixtySeconds = ethers.BigNumber.from('60')
const rewardRates = [
  ethers.utils.parseUnits('0.0115740740740741', 18),
  ethers.utils.parseUnits('0.0011574074074074', 18),
  ethers.utils.parseUnits('0.0028935185185185', 18)
]

module.exports = async (deployer, network) => {
  let addresses = {
    pools: {

    },
    cards: {

    }
  };

  addresses = require(`./../addresses/addresses/${network.replace('-fork', '')}.json`);

console.log(addresses);
  if (!addresses.token) await deployer.deploy(Arteon, 'Arteon', 'ART');
  const token = await Arteon.deployed()

  if (!addresses.exchange) await deployer.deploy(ArteonExchange, token.address);
  const arteonExchange = await ArteonExchange.deployed();

  if (!addresses.cards.genesis) await deployer.deploy(ArteonGPUGenesis);
  const Genesis = await ArteonGPUGenesis.deployed()

  if (!addresses.cards.artx1000) await deployer.deploy(ArteonGPUARTX1000);
  const ARTX1000 = await ArteonGPUARTX1000.deployed()

  if (!addresses.cards.artx2000) await deployer.deploy(ArteonGPUARTX2000);
  const ARTX2000 = await ArteonGPUARTX2000.deployed()

  if (!addresses.pools.genesis) await deployer.deploy(ArteonPoolGenesis, token.address, Genesis.address, SixtySeconds, rewardRates[0]);
  const GenesisPool = await ArteonPoolGenesis.deployed();

  if (!addresses.pools.artx1000) await deployer.deploy(ArteonPoolARTX1000, token.address, ARTX1000.address, SixtySeconds, rewardRates[1]);
  const ARTX1000Pool = await ArteonPoolARTX1000.deployed();

  if (!addresses.pools.artx2000) await deployer.deploy(ArteonPoolARTX2000, token.address, ARTX2000.address, SixtySeconds, rewardRates[2]);
  const ARTX2000Pool = await ArteonPoolARTX2000.deployed();


  if (network === 'ropsten' || network === 'kovan' || network === 'wapnet') {

      const _addresses = `{
  "token": "${token.address}",
  "exchange": "${arteonExchange.address}",
  "pools": {
    "genesis": "${GenesisPool.address}",
    "artx1000": "${ARTX1000Pool.address}",
    "artx2000": "${ARTX2000Pool.address}"
  },
  "cards": {
    "genesis": "${Genesis.address}",
    "artx1000": "${ARTX1000.address}",
    "artx2000": "${ARTX2000.address}"
  }
}`

    await Promise.all(
      [
        write(`mine/src/abis/arteon.js`, `export default ${JSON.stringify(token.abi, null, '\t')}`),
        write(`mine/src/abis/exchange.js`, `export default ${JSON.stringify(arteonExchange.abi, null, '\t')}`),
        write(`mine/src/abis/gpu.js`, `export default ${JSON.stringify(Genesis.abi, null, '\t')}`),
        write(`mine/src/abis/miner.js`, `export default ${JSON.stringify(GenesisPool.abi, null, '\t')}`),
        write(`addresses/addresses/${network}.js`, `export default ${_addresses}`),
        write(`addresses/addresses/${network}.json`, _addresses)
      ]
    )

    const pools = [
      GenesisPool.address,
      ArteonPoolARTX1000.address,
      ArteonPoolARTX2000.address
    ]

    let promises = []

    for (const pool of pools) {
      promises.push(token.minters(pool))
    }

    promises = await Promise.all(promises)

    promises.reduce((prev, current, i) => {
      if (!current) prev.push(token.addMinter(pools[i]))
      return prev
    }, [])

    promises = await Promise.all(promises)
  }

  let flats = await Promise.all([
    execSync('truffle-flattener contracts/pools/ArteonPoolGenesis.sol'),
    execSync('truffle-flattener contracts/gpus/ArteonGPUGenesis.sol'),
    execSync('truffle-flattener contracts/exchange/ArteonExchange.sol'),
  ])

  flats = flats.map(flat => flat.toString()
    .replace(/\/\/ SPDX-License-Identifier: MIT/g, '')
    .replace(/\/\/ File: (.*)\s\s/g, '')
    .replace(/pragma solidity (.*)\s/g, ''))

  await Promise.all([
    write(`build/flats/ArteonPoolGenesis.sol`, flats[0]),
    write(`build/flats/ArteonGPUGenesis.sol`, flats[1]),
    write(`build/flats/ArteonExchange.sol`, flats[2])
  ])
  console.log({
    token: token.address,
    exchange: arteonExchange.address,
    pools: {
      genesis: GenesisPool.address,
      artx1000: ARTX1000Pool.address,
      artx2000: ARTX2000Pool.address
    },
    cards: {
      genesis: Genesis.address,
      artx1000: ARTX1000.address,
      artx2000: ARTX2000.address
    }
  });
};
