import lotteryMaster from './lottery-master'
import ABI from './../../abis/lottery'
import ethers from 'ethers'
import chalk from 'chalk'

const run = async () => {
  let tx
  const contract = new ethers.Contract(lotteryMaster.addresses.lotteryProxy, ABI, lotteryMaster.signer)
  const currentLottery = await contract.latestLottery()
  const currenTime = Math.round(new Date().getTime() / 1000)
  if (currentLottery.endTime < currenTime && currentLottery.status === 1) {
    try {
      tx = await lotteryMaster.reveal(currentLottery.id)
      await tx.wait()
      console.log(chalk.green(`Revealed winningNumbers ${currentLottery.id}`));
    } catch (e) {
      console.log(chalk.red(`Failed Revealing winningNumbers ${currentLottery.id}`));
    }
    try {
      tx = await lotteryMaster.create()
      await tx.wait()
      console.log(chalk.green(`Created lottery ${Number(currentLottery.id) + 1}`));
    } catch (e) {
      console.log(chalk.red(`Failed creating lottery ${Number(currentLottery.id) + 1}`));
    }
  }
  setTimeout(() => {
    run()
  }, 60000);
}



run()
