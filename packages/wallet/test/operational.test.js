import assert from 'node:assert/strict'
import test from 'node:test'

import { Wallet } from '../src/wallet.js'

test('wallet initializes non-interactively with an injected password prompt', async () => {
  const previousPrompt = globalThis.prompt
  globalThis.prompt = async () => 'operational-test-password'
  try {
    const wallet = await new Wallet({ network: 'leofcoin' })
    assert.ok(wallet.wallet)
    assert.equal(typeof wallet.wallet.sign, 'function')
  } finally {
    globalThis.prompt = previousPrompt
  }
})
