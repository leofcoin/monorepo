import addresses from './../../../addresses/addresses/binance-smartchain'
import { abi as ABI } from './../../../build/contracts/ArtOnlineLottery.json'
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

const contract = new ethers.Contract(addresses.lotteryProxy, ABI, provider)

router.get('/lottery/tickets', async ctx => {
  const query = ctx.request.query
  const address = query.address
  const lottery = query.lottery || 1
  let tickets;
  if (address) {
    tickets = await ticketsContract.tickets(lottery, address)
  } else {

  }
})

export default router
