import addresses from './../../../addresses/addresses/binance-smartchain'
import { abi as ABI } from './../../../build/contracts/ArtOnline.json'
import {sendJSON} from './shared'
// import cache from './../cache'
import mime from 'mime-types'
import ethers from 'ethers'

import fetch from 'node-fetch'
import Router from '@koa/router'
const router = new Router()

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

const contract = new ethers.Contract(addresses.artonline, ABI, provider)

let burns = []
let mints = []
const burnAddress = '0x0000000000000000000000000000000000000000'
const contractAddress = '0x535e67270f4FEb15BFFbFE86FEE308b81799a7a5'

const _getBurns = async (fromBlock = 11399032, toBlock = 14086225) => {
  let response = await fetch(`https://api.bscscan.com/api?module=account&action=tokentx&startBlock=${fromBlock}&endBlock=${toBlock}&contractaddress=${contractAddress}&apiKey=JK5WD3G5Q2JY4JUNW7PDDM4XGMAQ9QXEMN`)
  response = await response.json()
  for (const tx of response.result) {
    if (tx.to === burnAddress) burns.push(tx)
    else if (tx.from === burnAddress) mints.push(tx)
  }
  if (response.result.length === 10000) return _getBurns(toBlock + 1, toBlock + 1000000)
  const currentBlock = await provider.getBlockNumber()
  if (toBlock < currentBlock) return _getBurns(toBlock + 1, toBlock + 1000000)

  setTimeout(() => {
    burns = []
    mints = []
    _getBurns()
  }, 120000);
}


_getBurns()

const price = async (currency = 'usd') => {
  let response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=artonline&vs_currencies=${currency}`)
  response = await response.json()
  return response.artonline[currency]
}

const priceJob = async currency => {
  if (!jobber[currency]) {
    jobber[currency] = {
      job: async () => {
        jobber[currency].value = await price(currency)
      }
    }
    await jobber[currency].job()
  }
}

router.get('/token/price', async ctx => {
  const query = ctx.request.query
  const currency = query.currency || 'usd'
  await priceJob(currency)
  ctx.body = jobber[currency].value
})

router.get('/token/mints', async ctx => {
  if (ctx.query.period === 'all' || ctx.query.period === undefined) {
    sendJSON(ctx, {transactions: mints, amount: Math.round(mints.reduce((p, c) => {
        p += Number(ethers.utils.formatUnits(c.value))
        return p
      }, 0) * 100) / 100})
    return
  }

  let timestamp = new Date().getTime() / 1000
  timestamp = Math.round(timestamp)
  if (ctx.query.period === '24h') {
    timestamp = Math.round(timestamp - ((24 * 60)*60))
  } else if (ctx.query.period === 'week') {
    timestamp = Math.round(timestamp - 604876)
  } else if (ctx.query.period === 'month') {
    timestamp = Math.round(timestamp - 2.628e+6)
  } else if (ctx.query.period === 'year') {
    timestamp = Math.round(timestamp - 3.154e+7)
  }
  const transactions = mints.reduce((p,c) => {
    if (Number(c.timeStamp) > timestamp) p.push(c)
    return p
  }, [])

  sendJSON(ctx, {transactions, amount: Math.round(transactions.reduce((p, c) => {
      p += Number(ethers.utils.formatUnits(c.value))
      return p
    }, 0) * 100) / 100})
})

router.get('/token/burns', async ctx => {
  if (ctx.query.period === 'all' || ctx.query.period === undefined) {
    sendJSON(ctx, {transactions: burns, amount: Math.round(burns.reduce((p, c) => {
        p += Number(ethers.utils.formatUnits(c.value))
        return p
      }, 0) * 100) / 100})
    return
  }

  let timestamp = new Date().getTime() / 1000
  timestamp = Math.round(timestamp)
  if (ctx.query.period === '24h') {
    timestamp = Math.round(timestamp - ((24 * 60)*60))
  } else if (ctx.query.period === 'week') {
    timestamp = Math.round(timestamp - 604876)
  } else if (ctx.query.period === 'month') {
    timestamp = Math.round(timestamp - 2.628e+6)
  } else if (ctx.query.period === 'year') {
    timestamp = Math.round(timestamp - 3.154e+7)
  }
  const transactions = burns.reduce((p,c) => {
    if (Number(c.timeStamp) > timestamp) p.push(c)
    return p
  }, [])
  sendJSON(ctx, {transactions, amount: Math.round(transactions.reduce((p, c) => {
      p += Number(ethers.utils.formatUnits(c.value))
      return p
    }, 0) * 100) / 100})
})


router.get('/token/totalBurnAmount', async ctx => {
  if (!jobber.totalBurnAmount) {
    jobber.totalBurnAmount = {
      job: async () => {
        jobber.totalBurnAmount.value = Math.round(burns.reduce((p, c) => {
            p += Number(ethers.utils.formatUnits(c.value))
            return p
          }, 0) * 100) / 100
      }
    }
    await jobber.totalBurnAmount.job()
  }
  ctx.body = jobber.totalBurnAmount.value
})

router.get('/token/totalMintAmount', async ctx => {
  if (!jobber.totalMintAmount) {
    jobber.totalMintAmount = {
      job: async () => {
        jobber.totalMintAmount.value = Math.round(mints.reduce((p, c) => {
            p += Number(ethers.utils.formatUnits(c.value))
            return p
          }, 0) * 100) / 100
      }
    }
    await jobber.totalMintAmount.job()
  }
  ctx.body = jobber.totalMintAmount.value
})

router.get('/token/stats', async ctx => {
  const query = ctx.request.query
  const currency = query.currency || 'usd'
  await priceJob(currency)

  const result = {
    burns,
    mints,
    price: jobber[currency].value
  }
  sendJSON(ctx, result)
})

export default router
