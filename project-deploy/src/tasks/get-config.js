import { read, glob } from './../utils.js'
import { join } from 'path'
import { mkdirSync } from 'fs'

const get = async path => {
  const file = await read(path)
  return JSON.parse(file)
}

const _import = async path => {
  const importee = await import(path)
  return importee.default
}

const buildPath = join(process.cwd(), 'build')

const defaultConfig = {
  buildPath,
  abiPath: join(buildPath, 'abis'),
  flatsPath: join(buildPath, 'flats'),
  addressesPath: join(buildPath, 'addresses'),
  bytecodePath: join(buildPath, 'bytecodes'),
  autoFix: true,
  license: 'MIT',
  networks: {
    'binance-smartchain-testnet': {
      rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97
    },
    'binance-smartchain': {
      rpcUrl: 'https://bsc-dataseed.binance.org',
      chainId: 56
    }
  },
  defaultNetwork: 'binance-smartchain-testnet'
};

export default async (config = {}) => {
  const paths = await glob(['project-deploy.config.*'])

  if (paths.length > 0) config = paths[0].includes('.json') && await get(paths[0])

  config = {...defaultConfig, ...config}

  try {
    mkdirSync(config.abiPath)
  } catch (e) {
  }
  try {
    mkdirSync(config.buildPath)
  } catch (e) {
  }
  try {
    mkdirSync(config.flatsPath)
  } catch (e) {

  }
  try {
    mkdirSync(config.addressesPath)
  } catch (e) {

  }
  try {
    mkdirSync(config.bytecodePath)
  } catch (e) {

  }
  return config
}
