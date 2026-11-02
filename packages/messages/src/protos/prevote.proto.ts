import { defineSchema } from '../schema.js'
export default defineSchema({
  blockHash: String(),
  index: BigInt(0),
  round: BigInt(0),
  from: String(),
  signature: String()
})
