import { join } from 'path'
import { getConfig, getContracts, getDependencies, compile } from './tasks/tasks.js'
import { getLogger } from './utils.js'

const defaultConfig = {
  buildPath: join(process.cwd(), 'build/contracts'),
  abiPath: join(process.cwd(), 'abis'),
  addressesPath: join(process.cwd(), 'addresses/addresses'),
  autoFix: true,
  licence: 'MIT'
};

(async () => {
  const logger = await getLogger()
  logger.stopAndPersist()
  logger.start('getting config')
  let config = await getConfig()
  logger.succeed()
  const solc = config.solc
  config = {...defaultConfig, ...config}
  logger.start('get contracts')
  const contractPaths = await getContracts(logger)
  const dependencies = await getDependencies(logger)
  logger.succeed()
  logger.start('compiling')
  await compile(contractPaths, dependencies, config.buildPath, config.solc)
  logger.succeed()
  // await deploy(contractPaths, config)
})()
