const ethers = require('ethers')
const holders = require('./../snapshots/snapshot.holders.json')
const balances = require('./../snapshots/snapshot.balances.json')
const ART_ONLINE_ABI = require('./../build/contracts/ArtOnline.json').abi
const addresses = require('./../addresses/addresses/binance-smartchain.json')
const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.ninicoin.io', {
  chainId: 56
})

const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);

const arteonSigner = new ethers.Contract(addresses.artonline, ART_ONLINE_ABI, signer);

arteonSigner.setPlatform('0x9D0F9765c2e912088b682DA9eaf7439a9440a6e4')
