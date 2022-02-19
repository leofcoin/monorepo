const ethers = require('ethers')
const PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json').abi
const addresses = require('./../addresses/addresses/binance-smartchain.json')
const dotenv = require('dotenv').config()
const {writeFile} = require('fs')
const {promisify} = require('util')
const {join} = require('path');
const blacklist = require('./blacklist.json')
const config = dotenv.parsed

const write = promisify(writeFile)

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.ninicoin.io', {
  chainId: 56
})
const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);
console.log(signer.address);
(async () => {
  const exchangeContract = new ethers.Contract(addresses.platform, PLATFORM_ABI, signer);
  const mintId = '3'
  const cap = await exchangeContract.callStatic.cap(mintId)

  let promises = []
  for (let i = 1; i <= cap; i++) {
    promises.push(exchangeContract.callStatic.ownerOf(mintId, ethers.BigNumber.from(i)))
  }

  let result = await Promise.allSettled(promises)
  let i = 0
  let possesors = []
  let mint = []
  result = result.filter(result => {
    i++
    if (result.status === 'fulfilled') {
      possesors.push(i)
      return {address: result.value, id: i}
    } else {
      mint.push(i.toString())
    }
  })
console.log(mint.map(i => i.toString()));
  // mint = mint.filter(i => ethers.BigNumber.from(i).lt(ethers.BigNumber.from('207')))

  const ids = mint.map(id => ethers.BigNumber.from(mintId))

  mint = mint.map(i => ethers.BigNumber.from(i))

  promises = []
  for (const id of ids) {
    const index = ids.indexOf(id)
    try {
      let tx = await exchangeContract.mint(signer.address, ethers.BigNumber.from(mintId), mint[index])
      await tx.wait()
    } catch (e) {
      console.error(e);
    }
  }


  // await tx.wait()
  // for (let id of mint) {
  //   tx = await exchangeContract.list('2', id, ethers.parseUnits('50500'))
  //   await tx.wait()
  // }
  // Promises.allSettled(promises).then(value => value.filter(promise.status === ''))
})()
