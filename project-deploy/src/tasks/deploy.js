import { ContractFactory } from 'ethers'

export default async ({ contractName, abi, bytecode }, params = [], signer, logger) => {
  const factory = new ContractFactory(abi, bytecode, signer)
  const contract = await factory.deploy(...params, { gasLimit: 21000000 })
  await contract.deployTransaction.wait()
  logger.info(`deployed ${contractName} as ${contract.address}`)
  return contract
}
