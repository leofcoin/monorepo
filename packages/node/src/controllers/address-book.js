import { getSelectedNetwork } from '../network-selection.js'
import { validateRecipientAddress } from './transfer.js'

const storageKey = (network) => `${network}:wallet-address-book:v1`

function getStorage(storage) {
  if (!storage) throw new Error('Address book storage is unavailable.')
  return storage
}

function readContacts(storage, network) {
  const value = getStorage(storage).getItem(storageKey(network))
  if (value === null) return []
  const data = JSON.parse(value)
  if (
    data?.version !== 1 ||
    !Array.isArray(data.contacts) ||
    data.contacts.some(
      (contact) =>
        typeof contact.name !== 'string' ||
        !contact.name.trim() ||
        typeof contact.address !== 'string' ||
        !contact.address.trim()
    )
  )
    throw new Error('The saved address book is invalid.')
  return data.contacts
}

function writeContacts(contacts, storage, network) {
  getStorage(storage).setItem(storageKey(network), JSON.stringify({ version: 1, contacts }))
  return contacts
}

function normalizeName(name) {
  const normalized = String(name || '').trim()
  if (!normalized) throw new Error('Enter a name for this contact.')
  if (normalized.length > 40) throw new Error('Contact names must be 40 characters or fewer.')
  return normalized
}

export function listContacts(storage = globalThis.localStorage, network = getSelectedNetwork().network) {
  return readContacts(storage, network)
}

export async function addContact(name, address, storage = globalThis.localStorage, network = getSelectedNetwork().network) {
  name = normalizeName(name)
  address = await validateRecipientAddress(address)
  const contacts = readContacts(storage, network)
  if (contacts.some((contact) => contact.address === address))
    throw new Error('This address is already in your address book.')
  return writeContacts([...contacts, { name, address }], storage, network)
}

export function renameContact(address, name, storage = globalThis.localStorage, network = getSelectedNetwork().network) {
  name = normalizeName(name)
  const contacts = readContacts(storage, network)
  if (!contacts.some((contact) => contact.address === address)) throw new Error('Contact not found.')
  return writeContacts(
    contacts.map((contact) => (contact.address === address ? { ...contact, name } : contact)),
    storage,
    network
  )
}

export function removeContact(address, storage = globalThis.localStorage, network = getSelectedNetwork().network) {
  const contacts = readContacts(storage, network)
  const updated = contacts.filter((contact) => contact.address !== address)
  if (updated.length === contacts.length) throw new Error('Contact not found.')
  return writeContacts(updated, storage, network)
}
