import test from 'node:test'
import assert from 'node:assert/strict'
import { FormatInterface } from '@leofcoin/codec-format-interface'
import { installBinaryPeerProtocol } from '../../src/binary-peer-protocol.ts'
import { decodeResponsePayload } from '../../src/helpers/response.ts'

test('registered peer schemas carry native arrays/maps/BigInts/bytes and reject JSON legacy bytes', async t => {
  class Response extends FormatInterface {
    constructor(value) { super(value, { response: Uint8Array.of() }, { name: 'peernet-response' }) }
  }
  const node = { protos: { 'peernet-response': Response } }
  installBinaryPeerProtocol(node)
  const previous = globalThis.peernet
  globalThis.peernet = node
  t.after(() => { globalThis.peernet = previous })
  const value = { hashes: ['hash-a', 'hash-b'], index: 1n << 100n, bytes: Uint8Array.of(42) }
  const bytes = new node.protos['peernet-response']({ response: value }).encoded
  assert.ok(bytes instanceof Uint8Array)
  assert.deepEqual(await decodeResponsePayload(bytes), value)
  const legacy = new Response({ response: { hashes: ['legacy'] } }).encoded
  await assert.rejects(decodeResponsePayload(legacy))
  for (const value of ['{}', {}, [1, 2], new TextEncoder().encode('{}')]) await assert.rejects(decodeResponsePayload(value))
})
