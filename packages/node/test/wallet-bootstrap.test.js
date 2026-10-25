import assert from 'node:assert/strict'
import test from 'node:test'
import generateAccount from '@leofcoin/generate-account'
import Identity from '@leofcoin/peernet/identity'
import { bindWalletToNode } from '../src/controllers/wallet-bootstrap.js'

const store = () => {
  const values = new Map()
  return {
    has: async (key) => values.has(key),
    put: async (key, value) => values.set(key, new TextEncoder().encode(value)),
    get: async (key) => values.get(key)
  }
}
test('the actual Peernet identity loader preserves the browser-generated wallet on first startup', async () => {
  const password = 'local-bootstrap-test-only'
  const wallet = await generateAccount(password, 'leofcoin:peach')
  wallet.selectedAccount = wallet.accounts[0][1]
  globalThis.walletStore = store()
  globalThis.accountStore = store()
  await bindWalletToNode(wallet, walletStore, accountStore)
  const identity = new Identity('leofcoin:peach')
  await identity.load(password)
  assert.equal(identity.selectedAccount, wallet.selectedAccount)
  assert.equal(identity.id, wallet.identity.walletId)
  assert.deepEqual(await identity.getAccounts(), wallet.accounts)
})

test('one shared encrypted wallet loads against isolated Peach and Mainnet account stores', async () => {
  const password = 'local-network-bootstrap-test-only'
  const wallet = await generateAccount(password, 'leofcoin:peach')
  wallet.selectedAccount = wallet.accounts[0][1]
  const walletStore = store()
  globalThis.walletStore = walletStore

  globalThis.accountStore = store()
  await bindWalletToNode(wallet, walletStore, globalThis.accountStore)
  const peach = new Identity('leofcoin:peach')
  await peach.load(password)

  globalThis.accountStore = store()
  await bindWalletToNode(wallet, walletStore, globalThis.accountStore)
  const mainnet = new Identity('leofcoin:mainnet')
  await mainnet.load(password)

  assert.equal(mainnet.id, peach.id)
  assert.equal(mainnet.selectedAccount, peach.selectedAccount)
  assert.deepEqual(await mainnet.getAccounts(), await peach.getAccounts())
})
