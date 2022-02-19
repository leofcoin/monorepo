const ethers = require('ethers')
const holders = require('./../snapshots/nft-holders-batch.json')
const ART_PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json').abi
const addresses = require('./../addresses/addresses/binance-smartchain.json')
const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.ninicoin.io', {
  chainId: 56
})

const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);
const arteonSigner = new ethers.Contract(addresses.platform, ART_PLATFORM_ABI, signer);
(async () => {
  // safetye mechanism
  return console.log('already dropped');
  let promises = []
  let nonce = await signer.getTransactionCount()
  for (const address of Object.keys(holders)) {
    const { ids, amounts } = holders[address]
    promises.push(arteonSigner.mintBatch(
      address,
      ids.map(id => ethers.BigNumber.from(id)),
      amounts.map(amount => ethers.BigNumber.from(amount)),
      { nonce: nonce++ }
    ))
  }
  promises = await Promise.all(promises)
  promises.map(tx => tx.wait())
  await Promise.all(promises)
})()
