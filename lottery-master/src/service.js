import lotteryMaster from './lottery-master'
import ABI from './../../abis/lottery'
import TICKETS_ABI from './../../abis/lotteryTickets'
import ethers from 'ethers'
import chalk from 'chalk'
import {lottery} from 'lucky-numbers';

let _timeout = 120000
const run = async () => {
  let tx
  const contract = new ethers.Contract(lotteryMaster.addresses.lotteryProxy, ABI, lotteryMaster.signer)
  const ticketContract = new ethers.Contract(lotteryMaster.addresses.lotteryTickets, TICKETS_ABI, lotteryMaster.signer)
  let currentLottery = await contract.latestLottery()
  const currentTime = Math.round(new Date().getTime() / 1000)
  // const currentTime = await contract.timestamp()
  console.log(currentTime);
  console.log(currentLottery.endTime.toNumber(), currentLottery.endTime.toNumber() < currentTime);
  if ((currentLottery.endTime.toNumber() * 1000) > new Date().getTime()) {

    _timeout = Math.round((currentLottery.endTime.toNumber() * 1000) - new Date().getTime()) - 3000
    console.log(`timing out ${_timeout}`);
  }
  if (currentLottery.endTime.toNumber() <= currentTime) {
    const numbers = lottery(6, 9)
    let supply = await ticketContract.totalSupply(currentLottery.id)
    let promises = []
    for (let i = 0; i <= supply; i++) {
      promises.push(ticketContract.getTicketNumbers(currentLottery.id, i))
    }
    promises = await Promise.all(promises)
    promises = promises.reduce((p, c, i) => {
      let matches = 0
      c = c.map(number => number.toNumber())
      c = c.join('')
      if (c.charAt(0) === numbers.join('').charAt(0)) matches += 1
      if (c.charAt(1) === numbers.join('').charAt(1)) matches += 1
      if (c.charAt(2) === numbers.join('').charAt(2)) matches += 1
      if (c.charAt(3) === numbers.join('').charAt(3)) matches += 1
      if (c.charAt(4) === numbers.join('').charAt(4)) matches += 1
      if (c.charAt(5) === numbers.join('').charAt(5)) matches += 1

      if (matches > 0) p.push({ticket: i, matches})
      return p
    }, [])
    console.log(promises);
    promises = promises.reduce((set, c) => {
      if (!set[Number(c.matches)]) set[c.matches] = 0;

      set[Number(c.matches)] += 1

      return set
    }, [])

    console.log(promises);
    try {
      const ticketPrice = ethers.utils.parseUnits('1000', 18)
      const startDelay = 10
      const duration = 240
      const pot = 100000
      tx = await lotteryMaster.create(
        ticketPrice,
        startDelay,
        duration,
        pot
      )
      await tx.wait()
      console.log(chalk.green(`Created lottery ${Number(currentLottery.id) + 1}`));
    } catch (e) {
      console.log(e);
      console.log(chalk.red(`Failed creating lottery ${Number(currentLottery.id) + 1}`));
    }

    try {
      tx = await lotteryMaster.reveal(currentLottery.id, numbers, promises)
      await tx.wait()
      console.log(chalk.green(`Revealed winningNumbers ${currentLottery.id}`));
    } catch (e) {
      console.log(e);
      console.log(chalk.red(`Failed Revealing winningNumbers ${currentLottery.id}`));
    }
    currentLottery = await contract.latestLottery()
    _timeout = Math.round((currentLottery.endTime.toNumber() * 1000) - new Date().getTime())
    console.log(`timing out ${_timeout}`);
  }

  setTimeout(() => {
    run()
  }, _timeout);
}



run()
