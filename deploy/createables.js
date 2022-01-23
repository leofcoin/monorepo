const CREATEABLES = require('./../build/contracts/Createables.json');

module.exports = async (deployer, addresses, contracts) => {
  if (!addresses.createables) {
    contracts.createables = await deployer.deploy('createables', CREATEABLES)
  }

  return {contracts, addresses}
}
