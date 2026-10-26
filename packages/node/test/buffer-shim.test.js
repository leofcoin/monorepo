import assert from 'node:assert/strict'
import test from 'node:test'
import { Buffer } from 'buffer'

test('browser compatibility shim exposes Buffer for wallet dependencies', async () => {
  const existingBuffer = globalThis.Buffer
  try {
    delete globalThis.Buffer
    await import('../src/shims/buffer.ts')
    assert.equal(globalThis.Buffer, Buffer)
    assert.equal(globalThis.Buffer.from('4869', 'hex').toString(), 'Hi')
    const { default: MultiSignature } = await import('multi-signature')
    const signatures = new MultiSignature(1, 1)
    const encoded = signatures.encode(new Uint8Array([42]))
    assert.deepEqual(signatures.decode(encoded).signature, new Uint8Array([42]))
  } finally {
    if (existingBuffer === undefined) delete globalThis.Buffer
    else globalThis.Buffer = existingBuffer
  }
})

test('browser compatibility shim does not replace an existing Buffer', async () => {
  const existingBuffer = globalThis.Buffer
  const customBuffer = class CustomBuffer {}
  try {
    globalThis.Buffer = customBuffer
    await import(`../src/shims/buffer.ts?existing=${Date.now()}`)
    assert.equal(globalThis.Buffer, customBuffer)
  } finally {
    if (existingBuffer === undefined) delete globalThis.Buffer
    else globalThis.Buffer = existingBuffer
  }
})
