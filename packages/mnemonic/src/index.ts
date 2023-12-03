import wordlist from './wordlist.js'
import { randombytes, pbkdf2, createHash } from '@leofcoin/crypto'

declare type options = {
  wordlist?: string[]
}

export default class Mnemonic {
  wordlist: string[]

  constructor(options: options) {
    // english always loaded, rest included by dev
    this.wordlist = options?.wordlist || wordlist
  }

  lpad(string: string, padString: string, length: number): string {
    while (string.length < length) {
      string = padString + string
    }
    return string
  }

  normalize(string: string): string {
    return (string || '').normalize('NFKD')
  }

  bytesToBinary(bytes: number[]): string {
    return bytes.map((byte: number) => this.lpad(byte.toString(2), '0', 8)).join('')
  }

  async deriveChecksumBits(entropyBuffer: Uint8Array): Promise<string> {
    const entropy = entropyBuffer.length * 8
    const cs = entropy / 32
    const hash = await createHash(entropyBuffer, 'SHA-512')
    return this.bytesToBinary(Array.from(hash)).slice(0, cs)
  }

  async mnemonicFromEntropy(entropyBuffer: Uint8Array): Promise<string> {
    let checksum = await this.deriveChecksumBits(entropyBuffer)
    const entropy = this.bytesToBinary(Array.from(entropyBuffer))

    let bits = entropy + checksum
    return bits
      .match(/(.{1,11})/g)
      .map((binary: string) => {
        const index = parseInt(binary, 2)
        return this.wordlist[index]
      })
      .join(' ')
  }

  generate(strength = 256): Promise<string> {
    return this.mnemonicFromEntropy(randombytes(strength / 8))
  }

  salt(password: string): string {
    return 'mnemonic' + this.normalize(password)
  }

  seedFromMnemonic(mnemonic: string, password: string, strength = 256, iterations = 2048): Promise<ArrayBuffer> {
    const encoder = new TextEncoder()
    return pbkdf2(
      encoder.encode(this.salt(password)),
      encoder.encode(this.normalize(mnemonic)),
      iterations,
      strength,
      'SHA-512'
    )
  }
}
