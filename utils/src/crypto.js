import randombytes from 'randombytes'
const {subtle} = crypto

const uint8ArrayToHex = uint8Array =>
  [...uint8Array].map(x => x.toString(16).padStart(2, '0')).join('')

const arrayBufferToHex = arrayBuffer =>
  uint8ArrayToHex(new Uint8Array(arrayBuffer))

const hexToUint8Array = hex =>
  new Uint8Array(hex.match(/[\da-f]{2}/gi).map(x => parseInt(x, 16)))

export const generatePbkdf2 = async (password) => {  
  return subtle.importKey(
    'raw',
    password,
    'PBKDF2',
    false,
    ['deriveBits']
  )  
}

export const pbkdf2 = async (password, salt, iterations = 4096, length = 64, hash = 'SHA-512') => {
  const key = await generatePbkdf2(password)
  const bits = await subtle.deriveBits({
    name: 'PBKDF2',
    hash,
    salt: salt,
    iterations,
  }, key, length);
  return bits;
}

const generateAesKey = async (length = 256) => {
  const key = await subtle.generateKey({
    name: 'AES-CBC',
    length
  }, true, ['encrypt', 'decrypt']);

  return key;
}

const importAesKey = async (exported, format = 'raw', length = 256) => {
  return await subtle.importKey(format, exported, {
    name: 'AES-CBC',
    length
  }, true, ['encrypt', 'decrypt'])
}

const exportAesKey = async (key, format = 'raw') => {
  return await subtle.exportKey(format, key)
}

const encryptAes = async (uint8Array, key, iv) => subtle.encrypt({
    name: 'AES-CBC',
    iv,
  }, key, uint8Array)

const decryptAes = async (uint8Array, key, iv) => subtle.decrypt({
    name: 'AES-CBC',
    iv,
  }, key, uint8Array)

export const encrypt = async string => {
  const ec = new TextEncoder();
  const key = await generateAesKey();
  const iv = await randombytes(16);
  const ciphertext = await encryptAes(ec.encode(string), key, iv)
  const exported = await exportAesKey(key)
  return {
    key: arrayBufferToHex(exported),
    iv: iv.toString('hex'),
    cipher: arrayBufferToHex(ciphertext)
  }
}

export const decrypt = async (cipher, key, iv) => {
  if (!key.type) key = await importAesKey(hexToUint8Array(key))
  cipher = new Uint8Array(hexToUint8Array(cipher))
  iv = new Uint8Array(hexToUint8Array(iv))

  const dec = new TextDecoder();
  const plaintext = await decryptAes(cipher, key, iv)

  return dec.decode(plaintext);
}

export const createHash = async (data, algorithm = 'SHA-512') => {
  return await subtle.digest(algorithm, data)
}

