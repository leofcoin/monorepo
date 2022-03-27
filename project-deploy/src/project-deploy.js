
import { getConfig, getContract, getDependencies, getAddresses, compile, deploy } from './tasks/tasks.js'
import inquirer from 'inquirer'
import { getLogger, write } from './utils.js'
import dotenv from 'dotenv'
import { join } from 'path'
import { providers, Wallet} from 'ethers'
const dotenvConfig = dotenv.config().parsed
const { prompt } = inquirer

export default async (source, params = [], network) => {
  const logger = await getLogger()
  const config = await getConfig()

  const provider = new providers.JsonRpcProvider(
    config.networks[network].rpcUrl,
    {
      chainId: config.networks[network].chainId
    }
  )

  if (!dotenvConfig[`${network}_PRIVATE_KEY`]) throw new Error(`No key found in .env for ${network}_PRIVATE_KEY`)

  const signer = new Wallet(dotenvConfig[`${network}_PRIVATE_KEY`], provider)

  const addresses = await getAddresses(config.addressesPath, network)
  const solc = config.solc
  const contractPaths = await getContract(source, logger)
  // for (const path of Object.keys(contractPaths)) {
    globalThis.deployable = true
    logger.info(`compiling ${source}`)
    const dependencies = await getDependencies(contractPaths[source].content, logger)
    let contract = await compile(contractPaths, dependencies, config, config.solc, logger)
    if (globalThis.deployable === true) {
      const contractName = contract.contractName
      if (addresses[contract.contractName]) {
        const answers = await prompt({
          type: 'confirm',
          name: 'deploy',
          default: false,
          message: `redeploy ${contract.contractName}?`
        })
        if (answers.deploy) {
          contract = await deploy(contract, params, signer, logger)
        }
      } else {
        contract = await deploy(contract, params, signer, logger)
      }

      addresses[contractName] = contract.address
      await write(join(config.addressesPath, `${network}.json`), JSON.stringify(addresses, null, 2))
    }
  // }
return contract
  // await deploy(contractPaths, config)
}
