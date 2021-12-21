import addresses from './../../../addresses/addresses/binance-smartchain-testnet'
import { abi as ERC1155_ABI } from './../../../build/contracts/ERC1155.json'
import { abi as ERC721_ABI } from './../../../build/contracts/ERC721.json'
import { abi as ABI } from './../../../build/contracts/ArtOnlineExchangeFactory.json'
import fetch from 'node-fetch'
// import cache from './../cache'
import jobber from './../jobber'
import mime from 'mime-types'
import ethers from 'ethers'
import Router from '@koa/router'
const router = new Router()

const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

const contract = new ethers.Contract(addresses.exchangeFactory, ABI, provider)

router.get('/nft', ctx => {
  ctx.body = 'v0.0.1-alpha'
})

const sendJSON = (ctx, value) => {
  ctx.type = mime.lookup('json')
  ctx.body = JSON.stringify(value)
}

const getMetadataURI = async (address, id, type) => {
  const contract = type === 'ERC1155' ?
                   new ethers.Contract(address, ERC1155_ABI, provider) :
                   new ethers.Contract(address, ERC721_ABI, provider)

  const uri = type === 'ERC1155' ? await contract.callStatic.uri(id) : await contract.callStatic.tokenURI(id)
  return uri.replace(`{id}`, id)
}

const getJsonFor = async (address, id, type) => {
  if (!jobber[`uri_${address}_${id}`]) {
    jobber[`uri_${address}_${id}`] = {
      job: async () => jobber[`uri_${address}_${id}`].value = await getMetadataURI(address, id, type)
    }
    jobber[`uri_${address}_${id}`].value = await jobber[`uri_${address}_${id}`].job()

  }

  const uri = jobber[`uri_${address}_${id}`].value
  const response = await fetch(uri)
  return response.json()
}

router.get('/nft/uri', async ctx => {
  const { address, id, type } = ctx.request.query
  if (!jobber[`uri_${address}_${id}`]) {
    jobber[`uri_${address}_${id}`] = {
      job: async () => jobber[`uri_${address}_${id}`].value = await getMetadataURI(address, id, type)
    }
    jobber[`uri_${address}_${id}`].value = await jobber[`uri_${address}_${id}`].job()
  }
  ctx.body = jobber[`uri_${address}_${id}`].value
})

router.get('/nft/json', async ctx => {
  const { address, id, type } = ctx.request.query
  if (!jobber[`json_${address}_${id}`]) {
    jobber[`json_${address}_${id}`] = {
      job: async () => jobber[`json_${address}_${id}`].value = await getJsonFor(address, id, type)
    }
    jobber[`json_${address}_${id}`].value = await jobber[`json_${address}_${id}`].job()
  }

  sendJSON(ctx, jobber[`json_${address}_${id}`].value)
})

export default router
