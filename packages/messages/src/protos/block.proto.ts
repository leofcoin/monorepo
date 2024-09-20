import { BigNumber } from '@leofcoin/utils'

export default {
  index: Number(),
  previousHash: String(),
  timestamp: Number(),
  reward: BigInt(0),
  fees: BigInt(0),
  transactions: Array(),
  validators: new Uint8Array()
}
