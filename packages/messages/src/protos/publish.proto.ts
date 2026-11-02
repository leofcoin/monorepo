import { defineSchema } from '../schema.js'
export default defineSchema({
  name: String(),
  version: Number(),
  publisher: String(),
  entry: String(),
  files: new Uint8Array()
})
