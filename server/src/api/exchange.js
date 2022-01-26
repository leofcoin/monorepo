import addresses from './../../../addresses/addresses/binance-smartchain'
import { abi as ERC1155_ABI } from './../../../build/contracts/ArtOnlineListingERC1155.json'
import { abi as ERC721_ABI } from './../../../build/contracts/ArtOnlineListing.json'
import { abi as ABI } from './../../../build/contracts/ArtOnlineExchangeFactory.json'
import { getJsonFor, sendJSON, getMetadataURI } from './shared'
// import cache from './../cache'
import jobber from './../jobber'
import mime from 'mime-types'
import ethers from 'ethers'
import Router from '@koa/router'
const router = new Router()

const twentyMinutes = 5 * 60 * 1000
const start = new Date().getTime()
const done = start + twentyMinutes

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

const contract = new ethers.Contract(addresses.exchangeFactory, ABI, provider)

router.get('/', ctx => {
  ctx.body = 'v0.0.1-alpha'
})

router.get('/countdown', ctx => {
  const now = new Date().getTime()
  if (done < now) ctx.body = String(0)
  else {
    ctx.body = String(done - now)
  }
})

const updateCache = (key, value) => {
  cache[key] = value
}

const listingListed = async (address) => {
  const listingContract = new ethers.Contract(address, ERC1155_ABI, provider)
  const listed = await listingContract.callStatic.listed()
  return listed.toNumber() === 1
}

router.get('/listings/ERC721', async ctx => {
  if (!jobber.listingsERC721) {
    jobber.listingsERC721 = {
      job: async () => {
        const listings = []
        const listingsLength = await contract.listingLength()
        for (let i = 0; i < listingsLength; i++) {
          const address = await contract.callStatic.listings(i)
          if (!jobber[`listed_${address}`]) {
            jobber[`listed_${address}`] = {
              job: async () => jobber[`listed_${address}`].value = await listingListed(address)
            }
          }
          listings.push({address, listed: jobber[`listed_${address}`].value})
        }
        jobber.listingsERC721.value = listings
      }
    }
    await jobber.listingsERC721.job()
  }
  sendJSON(ctx, jobber.listingsERC721.value)
})

router.get('/listings/ERC1155', async ctx => {
  if (!jobber.listingsERC1155) {
    jobber.listingsERC1155 = {
      job: async () => {
        const listings = []
        const listingsLength = await contract.listingERC1155Length()
        for (let i = 0; i < listingsLength; i++) {
          const address = await contract.callStatic.listingsERC1155(i)
          if (!jobber[`listed_${address}`] && address !== '0x5379fb967b4E7114A1B08532E128dEb553FE7cF9') {
            jobber[`listed_${address}`] = {
              job: async () => jobber[`listed_${address}`].value = await listingListed(address)
            }
          }
          listings.push({address, listed: await listingListed(address)})
        }
        jobber.listingsERC1155.value = listings
      }
    }

    await jobber.listingsERC1155.job()
  }
  sendJSON(ctx, jobber.listingsERC1155.value)
})

router.get('/listings', async ctx => {

  if (!jobber.listingsERC721) {
    const listings = []
    jobber['listingsERC721'] = {
      job: async () => {
        const listingsLength = await api.contract.listingLength()
        for (let i = 0; i < listingsLength; i++) {
          const address = await contract.callStatic.listings(i)
          listings.push({address, listed: await listingListed(address)})
        }
        jobber['listingsERC721'].value = listings
      }
    }
    await jobber['listingsERC721'].job()
  }

  if (!jobber.listingsERC1155) {
    const listings = []
    jobber['listingsERC1155'] = {
      job: async () => {
        const listingsLength = await api.contract.listingERC1155Length()
        for (let i = 0; i < listingsLength; i++) {
          const address = await contract.callStatic.listingsERC1155(i)
          if (addresses !== '0x5379fb967b4E7114A1B08532E128dEb553FE7cF9') listings.push({address, listed: await listingListed(address)})
        }
        jobber['listingERC1155'].value = listings
      }
    }
    await jobber['listingERC1155'].job()
  }
  sendJSON(ctx, {
    ERC1155: jobber['listingERC1155'].value,
    ERC721: jobber['listingERC721'].value
  })
})

router.get('/listing/info', async ctx => {
  const { address } = ctx.request.query
  if (!jobber[`listingInfo_${address}`]) {
    jobber[`listingInfo_${address}`] = {
      job: async () => {
        const contract = new ethers.Contract(address, ERC1155_ABI, provider)
        let promises = [
          contract.callStatic.price(),
          contract.callStatic.tokenId(),
          contract.callStatic.currency(),
          contract.callStatic.contractAddress(),
          listingListed(address)
        ]
        promises = await Promise.all(promises)
        let id
        let type = 'ERC721'
        try {
          id = await contract.callStatic.id()
          type = 'ERC1155'
        } catch (e) {
          console.log(e);
        }
        let tokenId
        if (promises[3] === addresses.createables) {
          tokenId = promises[1]
        }
        const json = await getJsonFor(promises[3], id ? id.toString() : promises[1], type, tokenId)
        const metadataURI = await getMetadataURI(promises[3], promises[1], type, tokenId)
        jobber[`listingInfo_${address}`].value = {
          price: ethers.utils.formatUnits(promises[0], 18),
          tokenId: promises[1].toString(),
          currency: promises[2],
          contractAddress: promises[3],
          listed: promises[4],
          metadataURI,
          json
        }
        if (id) jobber[`listingInfo_${address}`].value.id = id.toString()
      }
    }
    await jobber[`listingInfo_${address}`].job()
  }

  sendJSON(ctx, jobber[`listingInfo_${address}`].value)
})

router.get('/listing/listed', async ctx => {
  const { address } = ctx.request.query
  if (!jobber[`listed_${address}`]) {
    jobber[`listed_${address}`] = {
      job: async () => jobber[`listed_${address}`].value = await listingListed(address)
    }
    await jobber[`listed_${address}`].job()
  }

  ctx.body = jobber[`listed_${address}`].value
})

router.get('/listing/ERC721', async ctx => {
  const { address, tokenId } = ctx.params
  const listing = cache[`${address}_${tokenId}`] || await contract.callStatic.getListingERC721(address, tokenId)
  sendJSON(ctx, listing)
})

router.get('/listing/ERC1155', async ctx => {
  const { address, id, tokenId } = ctx.params
  const listing = cache[`${address}_${id}_${tokenId}`] || await contract.callStatic.getListingERC1155(address, id, tokenId)
  sendJSON(ctx, listing)
})

export default router
