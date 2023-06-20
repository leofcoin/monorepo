import randombytes from './lib/randombytes.js'
import createHash from './lib/create-hash.js'
import createDoubleHash from './lib/create-double-hash.js'
import { pbkdf2, generatePbkdf2 } from './lib/algorithms/pbkdf2.js'
import { generateAesKey, importAesKey, exportAesKey, encryptAes, decryptAes } from './lib/algorithms/aes.js'
import { generateHmacKey, exportHmacKey, importHmacKey, hmac } from './lib/algorithms/hmac.js'

export { randombytes, createHash, createDoubleHash, pbkdf2, generatePbkdf2, generateAesKey, importAesKey, exportAesKey, encryptAes, decryptAes, generateHmacKey, exportHmacKey, importHmacKey, hmac }
export const uint8ArrayToHex = uint8Array =>
  [...uint8Array].map(x => x.toString(16).padStart(2, '0')).join('')

export const arrayBufferToHex = arrayBuffer =>
  uint8ArrayToHex(new Uint8Array(arrayBuffer))

export const hexToUint8Array = hex =>
  new Uint8Array(hex.match(/[\da-f]{2}/gi).map(x => parseInt(x, 16)))

export const encrypt = async string => {
  const key = await generateAesKey()
  const iv = randombytes(16)
  const ciphertext = await encryptAes(new TextEncoder().encode(string), key, iv)
  const exported = await exportAesKey(key)
  return {
    key: arrayBufferToHex(exported),
    iv: uint8ArrayToHex(iv),
    cipher: arrayBufferToHex(ciphertext)
  }
}

export const decrypt = async ({cipher, key, iv}) => {
  if (!key.type) key = await importAesKey(hexToUint8Array(key))
  cipher = new Uint8Array(hexToUint8Array(cipher))
  iv = new Uint8Array(hexToUint8Array(iv))

  const plaintext = await decryptAes(cipher, key, iv)
  return new TextDecoder().decode(plaintext);
}