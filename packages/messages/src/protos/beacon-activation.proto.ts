import { defineSchema } from '../schema.js'
export default defineSchema({
  epoch: BigInt(0),
  configDigest: String(),
  from: String(),
  signature: String()
})
