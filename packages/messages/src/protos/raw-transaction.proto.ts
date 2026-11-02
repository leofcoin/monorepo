import { defineSchema } from '../schema.js'
import { RawTransaction } from '@leofcoin/types'

export default defineSchema({
  timestamp: Number(),
  from: String(),
  to: String(),
  method: String(),
  params: Array(),
  'nonce?': Number()
} as RawTransaction)
