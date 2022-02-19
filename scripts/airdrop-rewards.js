const ethers = require('ethers')
const claimable = require('./../snapshots/claimable-7-okt.json')
const ART_ONLINE_ABI = require('./../build/contracts/ArtOnline.json').abi
const addresses = require('./../addresses/addresses/binance-smartchain.json')
const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.ninicoin.io', {
  chainId: 56
})

const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);

const arteonSigner = new ethers.Contract(addresses.artonline, ART_ONLINE_ABI, signer);

(async () => {
  // safetye mechanism
  // return console.log('already dropped');

  for (const address of Object.keys(claimable)) {
    const tx = await arteonSigner.mint(address, ethers.utils.parseUnits(claimable[address], 18), {gasLimit: 200000})
    await tx.wait()
  }
})()
