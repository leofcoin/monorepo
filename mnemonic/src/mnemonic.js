import wordlist from './wordlist.js'
import randombytes from 'randombytes'
import { pbkdf2, createHash } from '@leofcoin/crypto'

export default class Mnemonic {
  constructor(options = {}) {
    if (!options.wordlist) this.wordlist = wordlist // english always loaded, rest included by dev
    else this.wordlist = options.wordlist
  }

  lpad(string, padString, length) {
    while (string.length < length) {
        string = padString + string;
    }
    return string;
  }

  normalize(string) {
    return (string || '').normalize('NFKD');
  }

  bytesToBinary(bytes) {
    return bytes.map(byte => this.lpad(byte.toString(2), '0', 8)).join('');
  }

  async deriveChecksumBits(entropyBuffer) {
    const entropy = entropyBuffer.length * 8;
    const cs = entropy / 32;
    const hash = await createHash(entropyBuffer, 'SHA-512')
    return this.bytesToBinary(Array.from(hash)).slice(0, cs);
  }

  async mnemonicFromEntropy(entropy) {
    if (!Buffer.isBuffer(entropy)) entropy = Buffer.from(entropy, 'hex')
    let checksum = await this.deriveChecksumBits(entropy)
    entropy = this.bytesToBinary(Array.from(entropy))
    let bits = entropy + checksum
    bits = bits.match(/(.{1,11})/g)
    return bits.map(binary => {
      const index = parseInt(binary, 2)
      return this.wordlist[index]
    }).join(' ')
  }

  /**
   * 
   * @param {Number} strength 256 / 8 = 32 = 24 words
   * @returns {String}
   */
  generate(strength = 256) {
    return this.mnemonicFromEntropy(randombytes(strength / 8))
  }

  salt(password) {
    return 'mnemonic' + this.normalize(password);
  }

  seedFromMnemonic(mnemonic, password, strength = 256, iterations = 2048) {
    const encoder =new TextEncoder()
    return pbkdf2(
      encoder.encode(this.salt(password)),
      encoder.encode(this.normalize(mnemonic)),
      iterations,
      strength,
      'SHA-512')
  }
}
