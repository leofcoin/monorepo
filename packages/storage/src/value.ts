import { decode, encode } from './encoding.js'

export default class KeyValue {
  uint8Array: Uint8Array

  constructor(input: string | Uint8Array | KeyValue) {
    if (typeof input === 'string') {
      this.uint8Array = encode(input)
    } else if (input instanceof Uint8Array) {
      this.uint8Array = input
    } else if (input instanceof KeyValue) {
      this.uint8Array = input.uint8Array
    } else {
      throw new Error('Invalid KeyValue, should be a String, Uint8Array or KeyValue')
    }
  }

  isKeyValue(): boolean {
    return true
  }

  toString(): string {
    return decode(this.uint8Array)
  }
}
