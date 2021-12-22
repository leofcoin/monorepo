
import ethers from 'ethers'
import { abi as ERC1155_ABI } from './../../../build/contracts/ERC1155.json'
import { abi as ERC721_ABI } from './../../../build/contracts/ERC721.json'
import jobber from './../jobber'
import fetch from 'node-fetch'

import mime from 'mime-types'

const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

export const sendJSON = (ctx, value) => {
  ctx.type = mime.lookup('json')
  ctx.body = JSON.stringify(value)
}

export const getMetadataURI = async (address, id, type) => {
  const contract = type === 'ERC1155' ?
                   new ethers.Contract(address, ERC1155_ABI, provider) :
                   new ethers.Contract(address, ERC721_ABI, provider)

  const uri = type === 'ERC1155' ? await contract.callStatic.uri(id) : await contract.callStatic.tokenURI(id)
  return uri.replace(`{id}`, id)
}

export const getJsonFor = async (address, id, type) => {
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
