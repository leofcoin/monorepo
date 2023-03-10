import { BigNumber } from "@leofcoin/utils"

export default {
  index: Number(),
  previousHash: String(),
  timestamp: Number(),
  reward: String(),
  fees: String(),
  transactions: new Uint8Array(),
  validators: new Uint8Array()
}
