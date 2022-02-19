const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const mainAddresses = require('./../addresses/addresses/binance-smartchain.json')
const platform = require('./../build/contracts/ArtOnlinePlatform.json')
const blacklist = require('./../snapshots/blacklist.json')
const ethers = require('ethers')
const {writeFile} = require('fs')
const {promisify} = require('util')
const {join} = require('path');
const owners = require('./owners.json')

const dotenv = require('dotenv').config()
const config = dotenv.parsed
const write = promisify(writeFile)
const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

const mainProvider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

const mainSigner = new ethers.Wallet(config.MAIN_PRIVATEKEY, mainProvider);

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider);


const mainPlatform = new ethers.Contract('0x9D0F9765c2e912088b682DA9eaf7439a9440a6e4', platform.abi, mainSigner)
const artOnlinePlatform = new ethers.Contract(addresses.platform, platform.abi, signer);

(async () => {
  const gpus = [0, 1, 2, 3, 4]
  const batch = []

  for (var i = 0; i < owners.length; i++) {
    const amounts = await mainPlatform.callStatic.balanceOfBatch([owners[i], owners[i], owners[i], owners[i], owners[i]], gpus)
    batch.push({owner: owners[i], amounts: amounts.map(n => n.toString())})
  }



  await write(join(__dirname, 'owners-batch.json'), JSON.stringify(batch, null, '\t'))

})()
