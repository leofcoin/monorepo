import { BigNumber } from '@leofcoin/utils'

export default {
  index: Number(),
  previousHash: String(),
  timestamp: Number(),
  reward: BigNumber.from(0),
  fees: BigNumber.from(0),
  transactions: new Uint8Array(),
  validators: new Uint8Array()
}
