const addresses = require('./../addresses/addresses/binance-smartchain.json')
const platform = require('./../build/contracts/ArtOnlinePlatform.json')
const ethers = require('ethers')
const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);
const artOnlinePlatform = new ethers.Contract(addresses.platform, platform.abi, signer);


(async () => {
  let tx
  // tx = await artOnlinePlatform.addToken('GENESIS', ethers.BigNumber.from('0'), ethers.BigNumber.from('50'))
  // await tx.wait()
  tx = await artOnlinePlatform.pause()
  await tx.wait()

})()
