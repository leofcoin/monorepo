const ethers = require('ethers')
const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const ARTEON_ABI = require('./../build/contracts/ArtOnline.json')

const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider);

const arteonSigner = new ethers.Contract(addresses.artonline, ARTEON_ABI.abi, signer);

(async () => {
  let mint = await arteonSigner.mint('0xD0A18Fd109F116c7bdb431d07aD6722d5A59F449', ethers.utils.parseUnits('10000000', 18), {gasLimit: 200000})
  await mint.wait()
})()
