import { decode, encode } from './encoding.js'

const pathSepS = '/'

export default class KeyPath {
  uint8Array: Uint8Array

  constructor(input: string | Uint8Array | KeyPath) {
    if (typeof input === 'string') {
      this.uint8Array = encode(input)
    } else if (input instanceof Uint8Array) {
      this.uint8Array = input
    } else if (input instanceof KeyPath) {
      this.uint8Array = input.uint8Array
    } else {
      throw new Error('Invalid keyPath, should be a String, Uint8Array or KeyPath')
    }
  }

  isKeyPath() {
    return true
  }

  toString(): string {
    return decode(this.uint8Array)
  }

  list(): string[] {
    return this.toString().split(pathSepS).slice(1)
  }
}
