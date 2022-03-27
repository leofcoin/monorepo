import { read, write } from './../utils.js'

export default async (version, path, logger) => {
  const data = await read(path)
  await write(path, `pragma solidity ${version};
${data.toString()}`)

  logger.info(`adding pragma solidity version ${version} for ${path}`)
}
