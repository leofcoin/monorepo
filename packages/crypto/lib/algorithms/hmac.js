import subtle from "../subtle.js"

export const generateHmacKey = (hash = 'SHA-512') => 
  subtle.generateKey({
    name: 'HMAC',
    hash,
  }, true, ['sign', 'verify'])

export const exportHmacKey = async (key, format = 'jwk', hash = 'SHA-512') =>
  subtle.exportKey( format, key ) 
  
export const importHmacKey = (keyData, format = 'jwk', hash = 'SHA-512') =>
  subtle.importKey(format, keyData, {
    name: 'HMAC',
    hash,
  }, true, ['sign', 'verify']);

export const hmac = (key, message) => 
  subtle.sign({
    name: 'HMAC',
  }, key, message)