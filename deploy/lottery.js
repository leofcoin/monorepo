const LOTTERY = require('./../build/contracts/ArtOnlineLottery.json');
const LOTTERY_TICKETS = require('./../build/contracts/LotteryTickets.json');
const RandomNumberGenerator = require('./../build/contracts/RandomNumberGenerator.json');
const ethers = require('ethers')

module.exports = async (deployer, addresses, contracts, signer) => {


  if (!addresses.lotteryTickets) {
    contracts.lotteryTickets = await deployer.deploy('lotteryTickets', LOTTERY_TICKETS, ['https://nfts.artonline.site/lotteryTicket'])
    if (addresses.lottery) {
      const contract = new ethers.Contract(addresses.lotteryTickets, LOTTERY_TICKETS.abi, signer)
      tx = await contract.setLotteryContract(addresses.lotteryProxy)
      await tx.wait()
    }
  }

  if (!addresses.lottery) {
    contracts.lottery = await deployer.deploy('lottery', LOTTERY)
    if (addresses.lotteryProxy) {
      let tx = await contracts.proxyManager.upgrade(addresses.lotteryProxy, addresses.lottery)
      await tx.wait()
      if (addresses.lotteryTickets) {
        const contract = new ethers.Contract(addresses.lotteryTickets, LOTTERY_TICKETS.abi, signer)
        tx = await contract.setLotteryContract(addresses.lotteryProxy)
        await tx.wait()
      }
    }

  }

  // if (!addresses.randomNumberGenerator) {
  //   const params = [
  //     addresses.chainlink.coordinator,
  //     addresses.chainlink.token,
  //     addresses.lotteryProxy,
  //     addresses.chainlink.keyHash,
  //     ethers.utils.parseUnits(addresses.chainlink.fee)
  //   ]

    // const params = [
    //   '0x747973a5A2a4Ae1D3a8fDF5479f1514F65Db9C31',
    //   '0x404460C6A5EdE2D891e8297795264fDe62ADBB75',
    // addresses.lottery,
    //   '0xc251acd21ec4fb7f31bb8868288bfdbaeb4fbfec2df3735ddbd4f7dc8d60103c',
    //   ethers.utils.parseUnits('0.2')
    // ]
    // contracts.randomNumberGenerator = await deployer.deploy('randomNumberGenerator', RandomNumberGenerator, params)
  // }

  return {contracts, addresses}
}
