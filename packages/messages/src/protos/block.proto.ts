import { BigNumber } from '@leofcoin/utils'

export default {
  index: Number(),
  previousHash: String(),
  timestamp: Number(),
  reward: BigNumber.from(0),
  fees: BigNumber.from(0),
  transactions: Array(),
  validators: new Uint8Array()
}
