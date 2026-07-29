import wordlist from './wordlist.js';
import { randombytes, pbkdf2, createHash } from '@leofcoin/crypto';
export default class Mnemonic {
    wordlist;
    constructor(options) {
        // english always loaded, rest included by dev
        this.wordlist = options?.wordlist || wordlist;
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
        return bytes.map((byte) => this.lpad(byte.toString(2), '0', 8)).join('');
    }
    async deriveChecksumBits(entropyBuffer) {
        const entropy = entropyBuffer.length * 8;
        const cs = entropy / 32;
        const hash = await createHash(entropyBuffer, 'SHA-512');
        return this.bytesToBinary(Array.from(hash)).slice(0, cs);
    }
    async mnemonicFromEntropy(entropyBuffer) {
        let checksum = await this.deriveChecksumBits(entropyBuffer);
        const entropy = this.bytesToBinary(Array.from(entropyBuffer));
        let bits = entropy + checksum;
        return bits
            .match(/(.{1,11})/g)
            .map((binary) => {
            const index = parseInt(binary, 2);
            return this.wordlist[index];
        })
            .join(' ');
    }
    generate(strength = 256) {
        return this.mnemonicFromEntropy(randombytes(strength / 8));
    }
    salt(password) {
        return 'mnemonic' + this.normalize(password);
    }
    seedFromMnemonic(mnemonic, password, strength = 256, iterations = 2048) {
        const encoder = new TextEncoder();
        return pbkdf2(encoder.encode(this.salt(password)), encoder.encode(this.normalize(mnemonic)), iterations, strength, 'SHA-512');
    }
}
