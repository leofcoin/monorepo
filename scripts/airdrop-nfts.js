const ethers = require('ethers')
const holders = require('./../snapshots/nft-holders.json')
const ART_PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json').abi
const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const dotenv = require('dotenv').config()
const config = dotenv.parsed

// const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.ninicoin.io', {
//   chainId: 56
// })
const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})
// const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);
//
// const arteonSigner = new ethers.Contract(addresses.artonline, ART_PLATFORM_ABI, signer);
const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider);
const arteonSigner = new ethers.Contract(addresses.platform, ART_PLATFORM_ABI, signer);
console.log(arteonSigner);
(async () => {
  // safetye mechanism
  return console.log('already dropped');
  let i = 0
  for (const nft of Object.keys(holders)) {
    for (const holder of holders[nft]) {
      try {
        const {address, id} = holder
        const tx = await arteonSigner.mint(address, ethers.BigNumber.from(i), ethers.BigNumber.from(id))
        await tx.wait()
      } catch (e) {
        console.error(e);
      }
    }
    i++
  }
})()
