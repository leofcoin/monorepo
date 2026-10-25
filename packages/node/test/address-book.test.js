import assert from 'node:assert/strict'
import test from 'node:test'
import { addContact, listContacts, removeContact, renameContact } from '../src/controllers/address-book.js'

const address = 'YTqzdvFjFnk7uX3tA54GaS1FyJXuAqRgnWZESKAsY19FDDDnHRdSN'
const network = 'leofcoin:peach'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  }
}

test('adds, renames, lists and removes named recipients', async () => {
  const storage = memoryStorage()
  assert.deepEqual(await addContact(' Alice ', ` ${address} `, storage, network), [{ name: 'Alice', address }])
  assert.deepEqual(renameContact(address, 'Alice Wallet', storage, network), [{ name: 'Alice Wallet', address }])
  assert.deepEqual(listContacts(storage, network), [{ name: 'Alice Wallet', address }])
  assert.deepEqual(removeContact(address, storage, network), [])
  assert.deepEqual(listContacts(storage, network), [])
})

test('rejects duplicate recipients, invalid addresses and empty names', async () => {
  const storage = memoryStorage()
  await addContact('Alice', address, storage, network)
  await assert.rejects(addContact('Alice again', address, storage, network), /already in your address book/)
  await assert.rejects(addContact('Bob', 'not-an-address', storage, network), /valid Leofcoin address/)
  await assert.rejects(addContact('  ', address, storage, network), /Enter a name/)
})

test('keeps address books separated by network and surfaces corrupted data', () => {
  const storage = memoryStorage()
  storage.setItem(`${network}:wallet-address-book:v1`, JSON.stringify({ version: 1, contacts: [{ name: 'Alice', address }] }))
  assert.deepEqual(listContacts(storage, network), [{ name: 'Alice', address }])
  assert.deepEqual(listContacts(storage, 'leofcoin:mainnet'), [])
  storage.setItem(`${network}:wallet-address-book:v1`, '{')
  assert.throws(() => listContacts(storage, network), SyntaxError)
})
