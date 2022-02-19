const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const mainAddresses = require('./../addresses/addresses/binance-smartchain.json')
const platform = require('./../build/contracts/ArtOnlinePlatform.json')
const blacklist = require('./../snapshots/blacklist.json')
const ethers = require('ethers')
const {writeFile} = require('fs')
const {promisify} = require('util')
const {join} = require('path');

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
const owners = []
;
(async () => {
  const gpus = [0, 1, 2, 3, 4]
  for (let i = 0; i < gpus.length; i++) {
    const cap = await mainPlatform.callStatic.cap(gpus[i])
    for (let token = 1; token <= cap; token++) {
      try {
        const owner = await mainPlatform.callStatic.ownerOf(i, token)

        if (owners.indexOf(owner) === -1 && blacklist.indexOf(owner) === -1) owners.push(owner)
      } catch (e) {
        console.log(`non existant ${gpus[i]} ${token}`);
      }
    }

  }

  await write(join(__dirname, 'owners.json'), JSON.stringify(owners, null, '\t'))

})()
