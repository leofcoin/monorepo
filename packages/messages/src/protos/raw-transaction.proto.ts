import { RawTransaction } from '@leofcoin/types'

export default {
  timestamp: Number(),
  from: String(),
  to: String(),
  method: String(),
  params: Array(),
  'nonce?': Number()
} as RawTransaction
