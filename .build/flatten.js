const { execSync } = require('child_process');
const { writeFile } = require('fs');
const { promisify } = require('util');

const write = promisify(writeFile);

(async () => {
  let flats = await Promise.all([
    execSync('truffle-flattener contracts/token/ArtOnline.sol'),
    execSync('truffle-flattener contracts/token/ArtOnlinePlatform.sol'),
    execSync('truffle-flattener contracts/exchange/ArtOnlineExchange.sol'),
    execSync('truffle-flattener contracts/exchange/ArtOnlineExchangeFactory.sol'),
    execSync('truffle-flattener contracts/token/ArtOnlineMining.sol'),
    execSync('truffle-flattener contracts/manage/ArtOnlinePoolPartner.sol'),
    execSync('truffle-flattener contracts/token/PartnershipToken.sol'),
    execSync('truffle-flattener contracts/lottery/ArtOnlineLotteryProxy.sol'),
    execSync('truffle-flattener contracts/lottery/ArtOnlineLottery.sol'),
    execSync('truffle-flattener contracts/lottery/LotteryTickets.sol')
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
    write(`build/flats/ArtOnlineExchangeFactory.sol`, flats[3]),
    write(`build/flats/ArtOnlineMining.sol`, flats[4]),
    write(`build/flats/ArtOnlinePoolPartner.sol`, flats[5]),
    write(`build/flats/PartnershipToken.sol`, flats[6]),
    write(`build/flats/ArtOnlineLotteryProxy.sol`, flats[7]),
    write(`build/flats/ArtOnlineLottery.sol`, flats[8]),
    write(`build/flats/LotteryTickets.sol`, flats[9])
    // write(`build/flats/ArteonPoolGenesis.sol`, flats[0]),
    // write(`build/flats/ArteonGPUGenesis.sol`, flats[1]),
    // write(`build/flats/ArteonExchange.sol`, flats[2]),
    // write(`build/flats/ArteonMiner.sol`, flats[3]),
    // write(`build/flats/Arteon.sol`, flats[4]),
  ])

})()
