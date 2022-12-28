import { createHash, arrayBufferToHex, encrypt, decrypt } from "../crypto.js"
const hash = '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043'

const canHash = await createHash('hello')
console.log('canHash');
if (arrayBufferToHex(canHash) !== hash) process.exit(1)

const canEncrypt = await encrypt('hello')
console.log('canEncrypt');
if (!canEncrypt?.key) process.exit(1)

const canDecrypt = await decrypt(canEncrypt)
console.log('canDecrypt');
if (canDecrypt !== 'hello') process.exit(1)

process.exit(0)