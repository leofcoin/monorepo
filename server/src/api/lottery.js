import addresses from './../../../addresses/addresses/binance-smartchain'
import provider from './provider'
// import cache from './../cache'
import mime from 'mime-types'
import ethers from 'ethers'
import Router from '@koa/router'
const router = new Router()

router.get('/countdown', ctx => {
  // const now = new Date().getTime()
  // if (done < now) ctx.body = String(0)
  // else {
  //   ctx.body = String(done - now)
  // }
})

router.get('/lottery/mint-ticket', async ctx => {
  const { address, proof } = ctx.params
  const listing = cache[`${address}_${id}_${tokenId}`] || await contract.callStatic.getListingERC1155(address, id, tokenId)
  sendJSON(ctx, listing)
})

export default router
