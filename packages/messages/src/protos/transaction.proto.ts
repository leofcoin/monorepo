import { Transaction } from '@leofcoin/types'

export default {
  timestamp: Number(),
  from: String(),
  to: String(),
  method: String(),
  params: Array(),
  signature: String(),
  'nonce?': Number(),
  'dependsOn?': Array(),
  'priority?': Boolean()
} as Transaction
