const ethers = require('ethers')
const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const ARTONLINE_EXCHANGE_ABI = require('./../build/contracts/ArtOnlineExchange.json')
const ARTONLINE_PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json')
const ARTONLINE_ABI = require('./../build/contracts/ArtOnline.json')

const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider);

const platform = new ethers.Contract(addresses.platform, ARTONLINE_PLATFORM_ABI.abi, signer);
const exchange = new ethers.Contract(addresses.exchange, ARTONLINE_EXCHANGE_ABI.abi, signer);
const artonline = new ethers.Contract(addresses.artonline, ARTONLINE_ABI.abi, signer);

const MINT_ROLE = '0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686';

(async () => {
  let tx
  tx = await artonline.grantRole(MINT_ROLE, addresses.exchange)
  await tx.wait()
  tx = await artonline.grantRole(MINT_ROLE, addresses.mining)
  await tx.wait()
  tx = await artonline.grantRole(MINT_ROLE, addresses.platform)
  await tx.wait()
  //
  tx = await exchange.setArtOnlinePlatform(addresses.platform)
  await tx.wait()
  tx = await exchange.setArtOnlineStaking(addresses.staking)
  await tx.wait()
  tx = await exchange.setArtOnline(addresses.artonline, {gasLimit: 210000})
  await tx.wait()
  // tx = await mining.setActivationPrice(ethers.BigNumber.from('5'), ethers.utils.parseUnits('3500', 18))
  // await tx.wait()
  // tx = await platform.setArtOnline(addresses.artonline, {gasLimit: 210000}),
  // await tx.wait()
})()
