const STAKING = require('./../build/contracts/ArtOnlineStaking.json');

module.exports = async (deployer, addresses, contracts) => {
  if (!addresses.staking) {
    contracts.staking = await deployer.deploy('staking', STAKING, [addresses.proxyManager])
    // let tx = await contracts.staking.initialize(addresses.bridger, addresses.access)
    // await tx.wait()
    // tx = await contracts.proxyManager.upgrade(addresses.stakingProxy, addresses.staking)
    // await tx.wait()
  }

  return {contracts, addresses}
}
