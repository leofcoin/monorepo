const ethers = require('ethers')
const test = require('tape')
const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const ARTEON_ABI = require('./../build/contracts/ArtOnline.json')
const PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json')

const dotenv = require('dotenv').config()
const config = dotenv.parsed

// const addresses = require('./addresses/addresses/ropsten.json')
const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider);

const platform = new ethers.Contract(addresses.platform, PLATFORM_ABI.abi, signer);

test('platform', async tape => {
  tape.plan(1)
  let addToken = await platformProxy.addToken('GENESIS', ethers.BigNumber.from('0'), ethers.BigNumber.from('50'), {gasLimit: 200000})
  await addToken.wait()
  let cap = await platform.cap('0')
  cap = cap.toString()
  tape.ok(cap ==='50', 'can add token')
})
