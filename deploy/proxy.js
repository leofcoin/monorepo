const PROXY_MANAGER = require('./../build/contracts/ProxyManager.json');
const UPGRADEABLE_PROXY = require('./../build/contracts/UpgradeableProxy.json');
const LOTTERY_PROXY = require('./../build/contracts/ArtOnlineLotteryProxy.json');
const GAMING_PROXY = require('./../build/contracts/ArtOnlineGamingProxy.json');
const GAMING = require('./../build/contracts/ArtOnlineGaming.json');
const LOTTERY = require('./../build/contracts/ArtOnlineLottery.json');
const ARTONLINE_ABI = require('./../build/contracts/ArtOnline.json');
const ethers = require('ethers')

const MINT_ROLE = '0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686'
module.exports = async (deployer, addresses, contracts, signer) => {
  if (!addresses.proxyManager) {
    contracts.proxyManager = await deployer.deploy('proxyManager', PROXY_MANAGER)
  }
  if (!addresses.gamingProxy && addresses.gaming) {
    contracts.gamingProxy = await deployer.deploy('gamingProxy', GAMING_PROXY, [addresses.gaming, addresses.proxyManager, '0x'])

    let contract = new ethers.Contract(addresses.gamingProxy, GAMING.abi, signer);
    let tx = await contract.initialize()
    await tx.wait()

    tx = await contract.setArtOnline(addresses.artonline)
    await tx.wait()

    contract = new ethers.Contract(addresses.artonline, ARTONLINE_ABI.abi, signer);
    tx = await contract.grantRole(MINT_ROLE, addresses.gamingProxy)
    await tx.wait()
  }
  if (!addresses.lotteryProxy && addresses.lottery) {
    contracts.lotteryProxy = await deployer.deploy('lotteryProxy', LOTTERY_PROXY, [addresses.lottery, addresses.proxyManager, '0x'])

    const contract = new ethers.Contract(addresses.lotteryProxy, LOTTERY.abi, signer);
    let tx = await contract.initialize()
    await tx.wait()
    tx = await contract.setRandomNumberGenerator(addresses.randomNumberGenerator)
    await tx.wait()
    tx = await contract.setMaxRange(ethers.BigNumber.from('9'))
    await tx.wait()
    tx = await contract.changeLotteryTicketsNFT(addresses.lotteryTickets)
    await tx.wait()
    tx = await contract.changeArtOnline(addresses.artonline)
    await tx.wait()
    tx = await contract.setLotterySize(ethers.BigNumber.from('6'))
    await tx.wait()
  }

  if (!addresses.createablesProxy) {
    contracts.createablesProxy = await deployer.deploy('createablesProxy', UPGRADEABLE_PROXY, [addresses.proxyManager])
  }

  if (!addresses.stakingProxy) {
    contracts.stakingProxy = await deployer.deploy('stakingProxy', UPGRADEABLE_PROXY, [addresses.proxyManager])
  }

  return {contracts, addresses}
}
