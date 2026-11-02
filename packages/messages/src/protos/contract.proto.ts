import { defineSchema } from '../schema.js'
export default defineSchema({
  creator: String(),
  contract: new Uint8Array(),
  constructorParameters: Array()
})
