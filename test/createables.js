const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const CREATEABLES = require('./../build/contracts/Createables.json')
const ethers = require('ethers')
const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider);
const createables = new ethers.Contract(addresses.createables, CREATEABLES.abi, signer);

(async () => {
  let tx
  tx = await createables.create(signer.address, 'Qmcm7wDXK787uWjJSP3F34jLY1pY9BKDvEiNESqzsnrAto')

})()
