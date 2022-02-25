import Router from '@koa/router'
const router = new Router()
import { getJsonFor, sendJSON, getMetadataURI } from './shared'

router.get('/nft', ctx => {
  ctx.body = 'v0.0.1-alpha'
})

router.get('/nft/uri', async ctx => {
  const { address, id, token, type } = ctx.request.query
  if (!jobber[`uri_${address}_${id}`]) {
    jobber[`uri_${address}_${id}`] = {
      job: async () => jobber[`uri_${address}_${id}`].value = await getMetadataURI(address, id, type, token)
    }
    jobber[`uri_${address}_${id}`].value = await jobber[`uri_${address}_${id}`].job()
  }
  ctx.body = jobber[`uri_${address}_${id}`].value
})

router.get('/nft/json', async ctx => {
  const { address, id, token, type } = ctx.request.query
  if (!jobber[`json_${address}_${id}`]) {
    jobber[`json_${address}_${id}`] = {
      job: async () => jobber[`json_${address}_${id}`].value = await getJsonFor(address, id, type, token)
    }
    jobber[`json_${address}_${id}`].value = await jobber[`json_${address}_${id}`].job()
  }

  sendJSON(ctx, jobber[`json_${address}_${id}`].value)
})

export default router
