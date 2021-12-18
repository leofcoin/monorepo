import { read, write } from './../utils.js'

export default async (version, path) => {
  let data = await read(path)
  data = data.toString()

  await write(path, data.replace(/pragma solidity (.*);/g, `pragma solidity ${version};`))
}
