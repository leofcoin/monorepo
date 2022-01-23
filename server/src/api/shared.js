
import ethers from 'ethers'
import { abi as ERC1155_ABI } from './../../../build/contracts/ERC1155.json'
import { abi as ERC721_ABI } from './../../../build/contracts/ERC721.json'
import jobber from './../jobber'
import fetch from 'node-fetch'
import { CID } from 'multiformats/cid'

import mime from 'mime-types'

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

export const sendJSON = (ctx, value) => {
  ctx.type = mime.lookup('json')
  ctx.body = typeof value === 'string' ? JSON.stringify(value, null, '\t') : value
}

export const getMetadataURI = async (address, id, type, tokenId) => {
  const contract = type === 'ERC1155' ?
                   new ethers.Contract(address, ERC1155_ABI, provider) :
                   new ethers.Contract(address, ERC721_ABI, provider)

  let uri
  if (tokenId) {
    uri = type === 'ERC1155' ? await contract.callStatic.uri(id, tokenId) : await contract.callStatic.tokenURI(id, tokenId)
  } else {
    uri = type === 'ERC1155' ? await contract.callStatic.uri(id) : await contract.callStatic.tokenURI(id)
  }

  return uri.replace(`{id}`, id)
}

export const getJsonFor = async (address, id, type, tokenId) => {
  if (!jobber[`uri_${address}_${id}`]) {
    jobber[`uri_${address}_${id}`] = {
      job: async () => jobber[`uri_${address}_${id}`].value = await getMetadataURI(address, id, type, tokenId)
    }
    await jobber[`uri_${address}_${id}`].job()
  }

  let uri = jobber[`uri_${address}_${id}`].value
  let response

  if (uri) {
    try {
      const cid = CID.parse(uri)
      uri = `https://ipfs.io/ipfs/${cid.toV1().toString()}`
      response = await fetch(uri)
      response = await response.text()
      response = JSON.parse(response.replace(/\n/g, '').replace(/\r/g, '').replace(/\t/g, '').replace(',}', '}'))
    } catch {
      response = await fetch(uri)
      response = await response.json()
    }

  }
  return response
}
