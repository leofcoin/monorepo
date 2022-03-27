import { read, write } from './../utils.js'

export default async (license, path, logger) => {
  const data = await read(path)
  await write(path, `// SPDX-License-Identifier: ${license}
${data.toString()}`)

  logger.info(`adding License ${license}; to ${path}`)
}
