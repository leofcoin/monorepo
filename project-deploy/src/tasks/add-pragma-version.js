import { read, write } from './../utils.js'

export default async (version, path) => {
  const data = await read(path)
  data = data.toString()
  await write(path, `pragma solidity ${version};
${data}`)
}
