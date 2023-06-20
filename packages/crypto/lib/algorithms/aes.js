import subtle from '../subtle.js'

export const generateAesKey = async (length = 256) => {
  const key = await subtle.generateKey({
    name: 'AES-CBC',
    length
  }, true, ['encrypt', 'decrypt']);

  return key;
}

export const importAesKey = async (exported, format = 'raw', length = 256) => {
  return await subtle.importKey(format, exported, {
    name: 'AES-CBC',
    length
  }, true, ['encrypt', 'decrypt'])
}

export const exportAesKey = async (key, format = 'raw') => {
  return await subtle.exportKey(format, key)
}

export const encryptAes = async (uint8Array, key, iv) => subtle.encrypt({
    name: 'AES-CBC',
    iv,
  }, key, uint8Array)

export const decryptAes = async (uint8Array, key, iv) => subtle.decrypt({
    name: 'AES-CBC',
    iv,
  }, key, uint8Array)