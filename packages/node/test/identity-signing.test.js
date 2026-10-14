import assert from 'node:assert/strict'
import test from 'node:test'
import generateAccount from '@leofcoin/generate-account'
import MultiWallet from '@leofcoin/multi-wallet'
import base58 from '@vandeurenglenn/base58'
import { createTransactionHash, signTransaction } from '@leofcoin/lib'
import IdentityController from '../src/controllers/identity.ts'

test('signs with the selected derived account and restores the encrypted backup', async () => {
  const password = 'local-test-only-password'
  const wallet = await generateAccount(password, 'leofcoin:peach')
  globalThis.walletStore = { get: async () => new TextEncoder().encode(JSON.stringify(wallet.accounts)) }
  const controller = new IdentityController('leofcoin:peach', wallet)
  await controller.unlock(password)
  const from = wallet.accounts[0][1]
  const raw = { from, to: from, method: 'transfer', params: [from, '1'], nonce: 1, timestamp: Date.now() }
  const signed = await signTransaction(raw, await controller.signer(from))
  const verifier = new MultiWallet('leofcoin:peach')
  await verifier.fromAddress(from, null, 'leofcoin:peach')
  assert.equal(await verifier.verify(base58.decode(signed.signature), await createTransactionHash(signed)), true)
  await assert.rejects(controller.signer('unknown'), /does not belong/)
  const backup = await controller.export(password)
  const restored = await new IdentityController('leofcoin:peach').import(password, backup)
  assert.equal(await (await restored.account(1).external(1)).address, from)
  await assert.rejects(controller.unlock('wrong-test-password'), /Check your password/)
  await assert.rejects(controller.signer(from), /Unlock your wallet/)
})
