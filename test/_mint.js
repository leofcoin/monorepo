const ethers = require('ethers')
const addresses = require('./../addresses/addresses/binance-smartchain.json')
const ARTEON_ABI = require('./../build/contracts/ArtOnline.json')

const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);

const arteonSigner = new ethers.Contract(addresses.artonline, ARTEON_ABI.abi, signer);

(async () => {
  for (var i = 0; i < 10000; i++) {
    const wallet = ethers.Wallet.createRandom()
    let mint = await arteonSigner.mint(wallet.address, ethers.utils.parseUnits('1', 18), {gasLimit: 200000})
    await mint.wait()
  }
})()
