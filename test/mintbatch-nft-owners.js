const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const mainAddresses = require('./../addresses/addresses/binance-smartchain.json')
const platform = require('./../build/contracts/ArtOnlinePlatform.json')
const blacklist = require('./../snapshots/blacklist.json')
const ethers = require('ethers')
const {writeFile} = require('fs')
const {promisify} = require('util')
const {join} = require('path');
const owners = require('./owners-batch.json')

const dotenv = require('dotenv').config()
const config = dotenv.parsed
const write = promisify(writeFile)
const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);

const artOnlinePlatform = new ethers.Contract(mainAddresses.platform, platform.abi, signer);

(async () => {
  const gpus = [0, 1, 2, 3, 4]
let promises = []
  const ownerBatch = []
  let nonce = await signer.getTransactionCount()

  for (let i = 0; i < owners.length; i++) {
    if (owners[i]) {
      const owner = owners[i]
      for (let key = 0; key < owner.amounts.length; key++) {
        console.log(key);
        const amounts = owner.amounts[key]
        if (amounts && amounts !== '0') {
          promises.push(artOnlinePlatform._mintAssets(owner.owner, ethers.BigNumber.from(key), ethers.BigNumber.from(amounts), {nonce: nonce++}))
        }
      }
      await Promise.allSettled(promises)
      promises = []
    }
  }



})()
