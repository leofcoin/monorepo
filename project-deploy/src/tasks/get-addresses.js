import { read } from './../utils.js'
import { join } from 'path'

export default async (path, network) => {
  let addresses
  try {
    addresses = await read(join(path, `${network}.json`))
    addresses = JSON.parse(addresses.toString())
  } catch (e) {
    addresses = []
  }
  return addresses
}
