import { read, write } from './../utils.js'

export default async (version, path, logger) => {
  let data = await read(path)
  data = data.toString()

  await write(path, data.replace(/pragma solidity (.*);/g, `pragma solidity ${version};`))
  logger.info(`updating pragma solidity version to ${version} for ${path}`)
}
