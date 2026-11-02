import { defineSchema } from '../schema.js'
export default defineSchema({
  epoch: BigInt(0),
  threshold: BigInt(0),
  participant: BigInt(0),
  from: String(),
  commitments: Array(),
  signature: String()
})
