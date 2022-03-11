import chalk from 'chalk';
import ethers from 'ethers'
import ABI from './../../../abis/lottery'
import ART from './../../../abis/artonline'
export default async (addresses, provider, signer, ticketPrice = ethers.utils.parseUnits('1000', 18), startDelay = 60, duration = 3600, pot = 100000) => {

  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()
  const UTCDate = Math.round(Math.round(new Date().getTime()) / 1000)

  const contract = new ethers.Contract(addresses.lotteryProxy, ABI, signer)
  const startTime = UTCDate + startDelay
  const endTime = UTCDate + duration // 2 hours
  const distribution = [ethers.BigNumber.from('1'), ethers.BigNumber.from('2'), ethers.BigNumber.from('3'), ethers.BigNumber.from('10'), ethers.BigNumber.from('30'), ethers.BigNumber.from('54')];
  const artOnline = new ethers.Contract(addresses.artonline, ART, signer)
  let balance = await artOnline.balanceOf(addresses.lotteryProxy)
  balance = ethers.utils.formatUnits(balance)
  balance = Math.round(Number(balance.toString()))

  console.log(balance);
  let tx;
  if (balance === 0) {

    tx = await artOnline.mint(addresses.lotteryProxy, ethers.utils.parseUnits(String(pot)))
    await tx.wait()
  } else if (balance < pot) {
    tx = await artOnline.mint(addresses.lotteryProxy, ethers.utils.parseUnits(String(pot - balance)))
    await tx.wait()
  }
  return contract.createLottery(startTime, endTime, ticketPrice, distribution, {gasLimit: 21000000})
}
