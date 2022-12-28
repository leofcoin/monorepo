# @leofcoin/crypto

## install

## usage
```js
import {} from '@leofcoin/crypto'
```

## checkout [breaking changes](./BREAKINGCHANGES.md)

## api

randombytes(length)

async createHash(data, algorithm)

uint8ArrayToHex(uint8Array)

arrayBufferToHex(arrayBuffer)

hexToUint8Array(hex)

async encrypt(string)

async decrypt({cipher, key, iv})

async generateAesKey(length)

async importAesKey(exported, format, length)

async exportAesKey(key, format)

async encryptAes(uint8Array, key, iv)

async decryptAes(uint8Array, key, iv)

async generatePbkdf2(password)

async pbkdf2(password, salt, iterations, length, hash)