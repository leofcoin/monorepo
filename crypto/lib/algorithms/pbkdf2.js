import subtle from './../subtle.js'

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
  return subtle.deriveBits({
    name: 'PBKDF2',
    hash,
    salt,
    iterations,
  }, key, length)
}