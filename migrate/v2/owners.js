const ethers = require('ethers')
const addresses = require('./../../addresses/addresses/binance-smartchain.json');
const PLATFORM_ABI = require('./../../build/contracts/ArtOnlinePlatform.json')
const MINING_ABI = require('./../../build/contracts/ArtOnlineMining.json')

const {writeFile} = require('fs')
const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})
const platform = new ethers.Contract(addresses.platform, PLATFORM_ABI.abi, provider)
const mining = new ethers.Contract(addresses.platform, MINING_ABI.abi, provider)
const tokenLength = 6

const tokens = []
const tokenIds = [];

const totalSupply = {};
const pools = {};
const earnings = {};

(async () => {
  for (let token = 0; token < tokenLength; token++) {
    let cap = await platform.callStatic.totalSupply(token)
    cap = cap.toNumber()
    totalSupply[token] = cap
    for (let i = 1; i <= cap; i++) {
      tokens.push(token)
      tokenIds.push(i)
    }
  }
  const owners = await platform.callStatic.ownerOfBatch(tokens, tokenIds)

  for (key of Object.keys(totalSupply)) {
    pools[key] = owners.slice(0, totalSupply[key])
    for (const pool of pools[key]) {
      let tx = await newPlatform._mintAssets(pool, key, 1)
      await tx.wait()
    }

    pools[key] = pools[key].reduce((p, c) => {
      if (p.indexOf(c) === -1) p.push(c)
      return p
    }, [])
  }

  for (let key of Object.keys(pools)) {
    for (address of pools[key]) {
      const earning = await mining.callStatic.earned(address, key)
      earnings[address] = earnings[address] ? earnings[address].add(earning) : earning
    }
  }

  for (let key of earnings) {
    await artOnline.mint(key, earnings[key])
  }
  console.log(earnings);
  writeFile('earnings.json', JSON.stringify(earnings, null, '\t'))
  writeFile('owners.json', JSON.stringify(_owners, null, '\t'))
  // console.log(totalSupply);
  // console.log(owners);
})()
