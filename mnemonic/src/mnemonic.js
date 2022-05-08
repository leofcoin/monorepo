import wordlist from './wordlist.js'
import randombytes from 'randombytes'
import { createHash, pbkdf2Sync } from 'crypto'

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

  deriveChecksumBits(entropyBuffer) {
    const entropy = entropyBuffer.length * 8;
    const cs = entropy / 32;
    const hash = createHash('sha256')
    hash.update(entropyBuffer)
    return this.bytesToBinary(Array.from(hash.digest())).slice(0, cs);
  }

  mnemonicFromEntropy(entropy) {
    if (!Buffer.isBuffer(entropy)) entropy = Buffer.from(entropy, 'hex')
    let checksum = this.deriveChecksumBits(entropy)
    entropy = this.bytesToBinary(Array.from(entropy))

    let bits = entropy + checksum
    bits = bits.match(/(.{1,11})/g)
    return bits.map(binary => {
      const index = parseInt(binary, 2)
      return this.wordlist[index]
    }).join(' ')
  }

  generate(strength = 256) {
    return this.mnemonicFromEntropy(randombytes(strength / 8))
  }

  salt(password) {
    return 'mnemonic' + this.normalize(password);
  }

  seedFromMnemonic(mnemonic, password) {
    const mnemonicBuffer = Buffer.from(this.normalize(mnemonic), 'utf8');
    const saltBuffer = Buffer.from(this.salt(password), 'utf8');
    return pbkdf2Sync(mnemonicBuffer, saltBuffer, 2048, 64, 'sha512')
  }
}
