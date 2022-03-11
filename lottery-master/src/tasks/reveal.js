import ABI from './../../../abis/lottery'
import ethers from 'ethers'

export default async (addresses, provider, signer, lotteryId, numbers = lottery(6, 9), matches) => {
  const contract = new ethers.Contract(addresses.lotteryProxy, ABI, signer)
  const proof = await signer.signMessage(Buffer.from(numbers))

  return contract.revealWinningNumbers(lotteryId, numbers, matches, proof)
}
