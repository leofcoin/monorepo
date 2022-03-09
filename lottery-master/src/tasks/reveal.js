import ABI from './../../../abis/lottery'
import {lottery} from 'lucky-numbers';
import ethers from 'ethers'

export default async (addresses, provider, signer, lottery) => {
  const contract = new ethers.Contract(addresses.lotteryProxy, ABI, signer)
  const numbers = lottery(6, 9)
  const proof = await signer.signMessage(Buffer.from(numbers))
  console.log(numbers);
  try {
    await contract.revealWinningNumbers(lottery, numbers, proof)
    // logger.info(`created lottery`)
  } catch (e) {
    console.warn(e);
    // logger.info(e)
  } finally {

  }
}
