import assert from 'node:assert/strict'
import test from 'node:test'

import { BinaryFormat as FormatInterface } from '@leofcoin/messages'
import { decodeResponsePayload } from '../../src/helpers/response.ts'
import { BlockMessage, LastBlockMessage } from '@leofcoin/messages'
import { resolveLastBlockMessage } from '../../src/helpers/last-block.ts'

class ResponseMessage extends FormatInterface {
  constructor(buffer) {
    super(buffer, { response: new Uint8Array() }, { name: 'peernet-response' })
  }
}

const blockInput = {
  index: 9n,
  previousHash: 'BA5PREVIOUS',
  timestamp: 1_785_703_291_262,
  reward: 150n,
  fees: 0n,
  transactions: [],
  validators: [{ address: 'validator', reward: 150n }],
  producer: 'validator',
  producerProof: 'proof',
  protocolVersion: '0.2.0'
}

test.beforeEach(() => {
  globalThis.peernet = {
    protos: { 'peernet-response': ResponseMessage },
    get: async () => undefined
  }
})

test.afterEach(() => {
  delete globalThis.peernet
})

test('decodes a direct lastBlock message without treating it as a response envelope', async () => {
  const encoded = new LastBlockMessage({ hash: 'BA5CURRENT', index: 9n }).encoded
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args)

  try {
    const resolved = await resolveLastBlockMessage(encoded)
    assert.deepEqual(resolved.decoded, { hash: 'BA5CURRENT', index: 9n })
    assert.deepEqual(warnings, [])
  } finally {
    console.warn = originalWarn
  }
})

test('unwraps an encoded peernet response exactly once', async () => {
  const lastBlock = new LastBlockMessage({ hash: 'BA5WRAPPED', index: 10n })
  const response = new ResponseMessage({ response: lastBlock.encoded })

  const resolved = await resolveLastBlockMessage(await decodeResponsePayload(response.encoded))
  assert.deepEqual(resolved.decoded, { hash: 'BA5WRAPPED', index: 10n })
})

test('rejects old block/hash/object/JSON tip representations instead of guessing', async () => {
  const block = new BlockMessage(blockInput)
  for (const value of [block.encoded, 'hash', {}, new TextEncoder().encode('{}')])
    await assert.rejects(resolveLastBlockMessage(value))
})
