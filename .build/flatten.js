const { execSync } = require('child_process');
const { writeFile } = require('fs');
const { promisify } = require('util');

const write = promisify(writeFile);

(async () => {
  let flats = await Promise.all([
    execSync('truffle-flattener contracts/token/ArtOnline.sol'),
    execSync('truffle-flattener contracts/token/ArtOnlinePlatform.sol'),
    execSync('truffle-flattener contracts/exchange/ArtOnlineExchange.sol'),
    execSync('truffle-flattener contracts/exchange/ArtOnlineExchangeFactory.sol')
    // execSync('truffle-flattener contracts/pools/ArteonPoolFactory.sol'),
    // execSync('truffle-flattener contracts/gpus/ArteonGPUGenesis.sol'),
    // execSync('truffle-flattener contracts/exchange/ArteonExchange.sol'),
    // execSync('truffle-flattener contracts/miner/ArteonMiner.sol'),
    // execSync('truffle-flattener contracts/token/Arteon.sol'),
  ])

  flats = flats.map(flat => flat.toString()
    .replace(/\/\/ SPDX-License-Identifier: MIT/g, '')
    .replace(/\/\/ File: (.*)\s\s/g, '')
    .replace(/pragma solidity (.*)\s/g, ''))

  await Promise.all([
    write(`build/flats/ArtOnline.sol`, flats[0]),
    write(`build/flats/ArtOnlinePlatform.sol`, flats[1]),
    write(`build/flats/ArtOnlineExchange.sol`, flats[2]),
    write(`build/flats/ArtOnlineExchangeFactory.sol`, flats[3])
    // write(`build/flats/ArteonPoolGenesis.sol`, flats[0]),
    // write(`build/flats/ArteonGPUGenesis.sol`, flats[1]),
    // write(`build/flats/ArteonExchange.sol`, flats[2]),
    // write(`build/flats/ArteonMiner.sol`, flats[3]),
    // write(`build/flats/Arteon.sol`, flats[4]),
  ])

})()
