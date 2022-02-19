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

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/', {
  chainId: 56
})
const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);
console.log(signer.address);
(async () => {
  const exchangeContract = new ethers.Contract(addresses.platform, PLATFORM_ABI, signer);
  const mintId = '3'
  const cap = await exchangeContract.callStatic.cap(mintId)
  console.log(cap);
  let promises = []
  for (let i = 1; i <= cap; i++) {
    promises.push(exchangeContract.callStatic.ownerOf(mintId, ethers.BigNumber.from(i)))
  }

  let result = await Promise.allSettled(promises)
  let i = 0
  let possesors = []
  let list = []
  result = result.filter(result => {
    i++
    if (result.status === 'fulfilled') {
      if (result.value === signer.address) list.push({address: signer.address, id: i})
    } else {
      console.log(result);
    }
  })
  console.log(list);
  // let tx = await exchangeContract.setPrice(ethers.BigNumber.from('2'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('50500'))
  // await tx.wait()
  let nonce = await signer.getTransactionCount()
  const ids = list.map(id => ethers.BigNumber.from(mintId))


  promises = []
  for (const id of ids) {
    const index = ids.indexOf(id)
    if (list[index].id < 207) {
      try {
        let tx = await exchangeContract.list(ethers.BigNumber.from(mintId), ethers.BigNumber.from(list[index].id), ethers.utils.parseUnits('110000'))
        await tx.wait()
      } catch (e) {
        console.log(list[index].id);

      }
    }

  }


  // await tx.wait()
  // for (let id of mint) {
  //   tx = await exchangeContract.list('2', id, ethers.parseUnits('50500'))
  //   await tx.wait()
  // }
  // Promises.allSettled(promises).then(value => value.filter(promise.status === ''))
})()
