const ethers = require('ethers')
const ART_PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json').abi
const addresses = require('./../addresses/addresses/binance-smartchain.json')
const holders = require('./../snapshots/presale-nft-holders.json')
const dotenv = require('dotenv').config()
const config = dotenv.parsed

// const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.ninicoin.io', {
//   chainId: 56
// })
const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.ninicoin.io', {
  chainId: 56
})
const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);

const arteonSigner = new ethers.Contract(addresses.platform, ART_PLATFORM_ABI, signer);

(async () => {
  // safetye mechanism
  return console.log('already dropped');
  let i = 1
  for (const address of holders) {
    const tx = await arteonSigner.mint(address, ethers.BigNumber.from(4), ethers.BigNumber.from(i))
    await tx.wait()
    i++
  }
})()
