const GAMING = require('./../build/contracts/ArtOnlineGaming.json');

module.exports = async (deployer, addresses, contracts) => {

  if (!addresses.gaming) {
    contracts.gaming = await deployer.deploy('gaming', GAMING)
    // let tx = await contracts.staking.initialize(addresses.bridger, addresses.access)
    // await tx.wait()
    // tx = await contracts.proxyManager.upgrade(addresses.stakingProxy, addresses.staking)
    // await tx.wait()
  }

  return {contracts, addresses}
}
