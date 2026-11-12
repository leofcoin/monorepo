import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isBlockProtocolCompatibleAtHeight,
  usesConsecutiveNoncesAtHeight
} from '../../src/consensus/protocol-activation.ts'

test('replays 0.5 history through block 13 and requires the active protocol from block 14', () => {
  assert.equal(isBlockProtocolCompatibleAtHeight(0, '0.5.9', '0.6.0'), true)
  assert.equal(isBlockProtocolCompatibleAtHeight(13n, '0.5.0', '0.6.0'), true)
  assert.equal(isBlockProtocolCompatibleAtHeight(13, '0.6.0', '0.6.0'), false)
  assert.equal(isBlockProtocolCompatibleAtHeight(14n, '0.5.0', '0.6.0'), false)
  assert.equal(isBlockProtocolCompatibleAtHeight(14, '0.6.9', '0.6.0'), true)
})

test('consecutive nonce validation begins at the activation height', () => {
  assert.equal(usesConsecutiveNoncesAtHeight(13), false)
  assert.equal(usesConsecutiveNoncesAtHeight(14n), true)
  assert.equal(usesConsecutiveNoncesAtHeight(-1), true)
  assert.equal(isBlockProtocolCompatibleAtHeight(-1, '0.6.0', '0.6.0'), false)
})
