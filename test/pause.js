const ethers = require('ethers')
const addresses = require('./../addresses/addresses/binance-smartchain.json')
const ACCESS_ABI = require('./../build/contracts/ArtOnlineAccess.json')

const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);

const arteonSigner = new ethers.Contract(addresses.access, ACCESS_ABI.abi, signer);

(async () => {
  // for (var i = 0; i < 10000; i++) {
    // const wallet = ethers.Wallet.createRandom()
    let mint = await arteonSigner.unpause()
    // await mint.wait()
  // }
})()
