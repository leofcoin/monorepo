import assert from 'node:assert/strict'
import test from 'node:test'

import { arrayBufferToHex, createHash, decrypt, encrypt } from '../crypto.js'

test('hash, encrypt, and decrypt round-trip', async () => {
  const expectedHash =
    '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7' +
    '2323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043'
  const hash = await createHash(new TextEncoder().encode('hello'))
  assert.equal(arrayBufferToHex(hash), expectedHash)

  const encrypted = await encrypt('hello')
  assert.ok(encrypted?.key)
  assert.equal(await decrypt(encrypted), 'hello')
})
