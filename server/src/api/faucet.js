// import cache from './../cache'
import ABI from './../../../abis/artonline'
import mime from 'mime-types'
import ethers from 'ethers'
import Router from '@koa/router'
import { join } from 'path'
const router = new Router()

const timedOut = {}


const dotenv = require('dotenv').config()
const config = dotenv.parsed

const network = 'binance-smartchain-testnet'

const rpcUrls =  {
  'art-ganache': 'http://127.0.0.1:1337',
  'binance-smartchain-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
  'binance-smartchain': 'https://bsc-dataseed.binance.org'
}
const chainIds =  {
  'art-ganache': 1337,
  'binance-smartchain-testnet': 97,
  'binance-smartchain': 56
}

let addresses = require(join(__dirname, `./../../addresses/addresses/${network}.json`))

const provider = new ethers.providers.JsonRpcProvider( rpcUrls[network], {
  chainId: chainIds[network]
})
// 127.0.0.1:1337

const signer = new ethers.Wallet(config.FAUCET_PRIVATEKEY, provider)

const contract = new ethers.Contract(addresses.artonline, ABI, signer)

const timedOutMessage = ctx => {
  ctx.body = `${ctx.request.query.address} on timeout`
}

router.get('/faucet', async ctx => {
  if (timedOut[ctx.request.header['cf-connecting-ip']]) return timedOutMessage(ctx)
  if (timedOut[ctx.request.query.address]) return timedOutMessage(ctx)
  const time = new Date().getTime() + 8.64e+7
  timedOut[ctx.resuest.query.address] = time
  timedOut[ctx.request.header['cf-connecting-ip']] = time
  let tx = await contract.transfer(ctx.request.query.address, ethers.utils.parseUnits('50000'))
  // console.log(tx);
  ctx.body = tx.hash
})

router.get('/faucet/tot', ctx => {
  if (timedOut[ctx.request.header['cf-connecting-ip']])
    String(timedOut[ctx.request.header['cf-connecting-ip']])

  if (ctx.request.query.address) ctx.body =
    String(timedOut[ctx.request.query.address])
})

export default router
