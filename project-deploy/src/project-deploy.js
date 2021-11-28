import getConfig from './config.js'
import getContracts from './contracts.js'
import deploy from './deploy.js'
import { join } from 'path'

const defaultConfig = {
  contractsPath: join(process.cwd(), 'build/contracts'),
  abiPath: join(process.cwd(), 'abis'),
  addressesPath: join(process.cwd(), 'addresses/addresses')
};

(async () => {
  let config = await getConfig()

  config = {...defaultConfig, ...config}

  const contracts = await getContracts(config.contractsPath)
  await deploy(contracts, config)
})
