# @leofcoin/crypto

## install

## usage
```js
import {
  uint8ArrayToHex,
  arrayBufferToHex,
  hexToUint8Array,
  randombytes,
  createHash,
  encrypt,
  decrypt,
  generateAesKey,
  importAesKey,
  exportAesKey,
  encryptAes,
  decryptAes,
  generatePbkdf2,
  pbkdf2
} from '@leofcoin/crypto'
```

## checkout [breaking changes](./BREAKINGCHANGES.md)

## api

uint8ArrayToHex(uint8Array)

arrayBufferToHex(arrayBuffer)

hexToUint8Array(hex)

randombytes(length)

async createHash(data, algorithm)

async encrypt(string)

async decrypt({cipher, key, iv})

async generateAesKey(length)

async importAesKey(exported, format, length)

async exportAesKey(key, format)

async encryptAes(uint8Array, key, iv)

async decryptAes(uint8Array, key, iv)

async generatePbkdf2(password)

async pbkdf2(password, salt, iterations, length, hash)