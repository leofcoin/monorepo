import { createDeviceCertificate, createDeviceKeys, verifyDeviceCertificate } from './chat-security.js'

const DATABASE_NAME = 'leofcoin-chat-devices'
const DATABASE_VERSION = 2
const STORE_NAME = 'devices'
const SPACE_STORE_NAME = 'spaces'
const KNOWN_DEVICES_LIMIT = 200

function knownDevicesKey(network) {
  return `${network}:chat-known-devices:v1`
}

function openDatabase(indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains(SPACE_STORE_NAME))
        request.result.createObjectStore(SPACE_STORE_NAME, { keyPath: 'id' })
    }
    request.onerror = () => reject(request.error || new Error('Could not open secure chat device storage.'))
    request.onsuccess = () => resolve(request.result)
  })
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not access secure chat device storage.'))
  })
}

function createDeviceId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function readDevice(database, id) {
  const transaction = database.transaction(STORE_NAME, 'readonly')
  const record = await requestValue(transaction.objectStore(STORE_NAME).get(id))
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error || new Error('Could not read the chat device identity.'))
    transaction.onabort = () => reject(transaction.error || new Error('Chat device identity read was aborted.'))
  })
  return record
}

async function addDevice(database, record) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).add(record)
    transaction.oncomplete = () => resolve(true)
    transaction.onerror = () => {
      if (transaction.error?.name === 'ConstraintError') resolve(false)
      else reject(transaction.error || new Error('Could not save the chat device identity.'))
    }
    transaction.onabort = () => reject(transaction.error || new Error('Chat device identity save was aborted.'))
  })
}

async function updateDevice(database, record) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(record)
    transaction.oncomplete = () => resolve(true)
    transaction.onerror = () => reject(transaction.error || new Error('Could not update the chat device identity.'))
    transaction.onabort = () => reject(transaction.error || new Error('Chat device identity update was aborted.'))
  })
}

function transactionComplete(transaction, message) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error || new Error(message))
    transaction.onabort = () => reject(transaction.error || new Error(`${message} (aborted)`))
  })
}

async function deriveLocalSpaceKey(device) {
  const publicKey = await crypto.subtle.importKey(
    'raw',
    device.keys.encryption.publicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    device.keys.encryption.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function readSpace(database, id) {
  const transaction = database.transaction(SPACE_STORE_NAME, 'readonly')
  const record = await requestValue(transaction.objectStore(SPACE_STORE_NAME).get(id))
  await transactionComplete(transaction, 'Could not read the saved Space.')
  return record
}

async function readSpaces(database) {
  const transaction = database.transaction(SPACE_STORE_NAME, 'readonly')
  const records = await requestValue(transaction.objectStore(SPACE_STORE_NAME).getAll())
  await transactionComplete(transaction, 'Could not read saved Spaces.')
  return records
}

async function writeSpace(database, record) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SPACE_STORE_NAME, 'readwrite')
    transaction.objectStore(SPACE_STORE_NAME).put(record)
    transaction.oncomplete = () => resolve(true)
    transaction.onerror = () => reject(transaction.error || new Error('Could not save the Space.'))
    transaction.onabort = () => reject(transaction.error || new Error('Space save was aborted.'))
  })
}

export async function loadOrCreateChatDevice({
  account,
  network,
  signWithAccount,
  indexedDB = globalThis.indexedDB
}) {
  if (!account || !network || typeof signWithAccount !== 'function')
    throw new Error('Account, network and unlocked wallet signer are required.')
  if (!indexedDB) throw new Error('Secure browser storage is unavailable for chat device keys.')
  const id = `${network}:${account}`
  const database = await openDatabase(indexedDB)

  try {
    const existing = await readDevice(database, id)
    if (existing) {
      if (!(await verifyDeviceCertificate(existing.certificate, network)))
        throw new Error('The saved chat device certificate is invalid.')
      if (
        existing.account !== account ||
        existing.network !== network ||
        existing.certificate.account !== account ||
        existing.certificate.network !== network ||
        existing.certificate.deviceId !== existing.deviceId
      )
        throw new Error('The saved chat device identity does not match this wallet and network.')
      return existing
    }

    const deviceId = createDeviceId()
    const keys = await createDeviceKeys()
    const certificate = await createDeviceCertificate({ account, network, deviceId, keys, signWithAccount })
    const record = { id, account, network, deviceId, keys, certificate }
    if (await addDevice(database, record)) return record

    const concurrentRecord = await readDevice(database, id)
    if (
      !concurrentRecord ||
      !(await verifyDeviceCertificate(concurrentRecord.certificate, network)) ||
      concurrentRecord.certificate.account !== account ||
      concurrentRecord.certificate.deviceId !== concurrentRecord.deviceId
    )
      throw new Error('A concurrent chat-device registration produced an invalid identity.')
    return concurrentRecord
  } finally {
    database.close()
  }
}

export async function saveChatDeviceCertificate(certificate, indexedDB = globalThis.indexedDB) {
  if (!certificate?.account || !certificate.network || !certificate.deviceId)
    throw new Error('A valid chat device certificate is required.')
  if (!indexedDB) throw new Error('Secure browser storage is unavailable for chat device keys.')
  const database = await openDatabase(indexedDB)
  try {
    const id = `${certificate.network}:${certificate.account}`
    const record = await readDevice(database, id)
    if (!record || record.deviceId !== certificate.deviceId)
      throw new Error('The approved certificate does not match this saved device.')
    await updateDevice(database, { ...record, certificate })
    return certificate
  } finally {
    database.close()
  }
}

export async function saveChatSpace(
  { account, network, spaceId, name, ownerAccount, keyBytes },
  device,
  indexedDB = globalThis.indexedDB
) {
  if (
    !account ||
    !network ||
    !spaceId ||
    !name ||
    name.length > 80 ||
    !ownerAccount ||
    !(keyBytes instanceof Uint8Array) ||
    keyBytes.length !== 32 ||
    device?.account !== account ||
    device?.network !== network
  )
    throw new Error('A valid Space identity, name and key are required.')
  if (!indexedDB) throw new Error('Secure browser storage is unavailable for chat Spaces.')
  const id = `${network}:${account}:${spaceId}`
  const database = await openDatabase(indexedDB)
  try {
    const existing = await readSpace(database, id)
    if (existing) {
      const spaces = await listChatSpaces(account, network, device, indexedDB)
      const saved = spaces.find((space) => space.spaceId === spaceId)
      if (!saved || saved.ownerAccount !== ownerAccount || saved.name !== name)
        throw new Error('This Space ID is already registered with different details.')
      if (saved.keyBytes.some((byte, index) => byte !== keyBytes[index]))
        throw new Error('This Space ID is already registered with a different encryption key.')
      return saved
    }
    const key = await deriveLocalSpaceKey(device)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, keyBytes)
    )
    const record = {
      id,
      account,
      network,
      spaceId,
      name,
      ownerAccount,
      iv,
      ciphertext
    }
    await writeSpace(database, record)
    return { ...record, keyBytes }
  } finally {
    database.close()
  }
}

export async function listChatSpaces(account, network, device, indexedDB = globalThis.indexedDB) {
  if (!account || !network || device?.account !== account || device?.network !== network)
    throw new Error('A matching chat device is required to load Spaces.')
  if (!indexedDB) throw new Error('Secure browser storage is unavailable for chat Spaces.')
  const database = await openDatabase(indexedDB)
  try {
    const records = await readSpaces(database)
    const localRecords = records.filter((record) => record.account === account && record.network === network)
    const key = await deriveLocalSpaceKey(device)
    return await Promise.all(
      localRecords.map(async (record) => ({
        ...record,
        keyBytes: new Uint8Array(
          await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: record.iv },
            key,
            record.ciphertext
          )
        )
      }))
    )
  } finally {
    database.close()
  }
}

export function listTrustedChatDevices(storage = globalThis.localStorage, network, account) {
  if (!storage || typeof storage.getItem !== 'function') throw new Error('Chat device preferences are unavailable.')
  if (!network || !account) throw new Error('Network and wallet address are required.')
  const value = storage.getItem(`${network}:chat-trusted-devices:v1:${account}`)
  if (value === null) return []
  const parsed = JSON.parse(value)
  if (!Array.isArray(parsed) || parsed.some((certificate) => certificate?.account !== account || certificate.network !== network))
    throw new Error('Saved trusted chat devices are invalid.')
  return parsed
}

export function trustChatDevice(certificate, storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
    throw new Error('Chat device preferences are unavailable.')
  if (!certificate?.account || !certificate.network || !certificate.deviceId)
    throw new Error('A valid chat device certificate is required.')
  const key = `${certificate.network}:chat-trusted-devices:v1:${certificate.account}`
  const saved = storage.getItem(key)
  const devices = saved === null ? [] : JSON.parse(saved)
  if (!Array.isArray(devices)) throw new Error('Saved trusted chat devices are invalid.')
  if (
    !devices.some(
      (device) =>
        device.deviceId === certificate.deviceId &&
        device.signingKey === certificate.signingKey &&
        device.encryptionKey === certificate.encryptionKey
    )
  )
    devices.push(certificate)
  storage.setItem(key, JSON.stringify(devices))
  return devices
}

export function listKnownChatDevices(network, storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function') throw new Error('Chat device preferences are unavailable.')
  if (!network) throw new Error('A chat network is required.')
  const value = storage.getItem(knownDevicesKey(network))
  if (value === null) return []
  const devices = JSON.parse(value)
  if (
    !Array.isArray(devices) ||
    devices.some((device) => device?.network !== network || !device.account || !device.deviceId)
  )
    throw new Error('Saved known chat devices are invalid.')
  return devices
}

export function rememberChatDevice(certificate, storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
    throw new Error('Chat device preferences are unavailable.')
  if (!certificate?.account || !certificate.network || !certificate.deviceId)
    throw new Error('A valid chat device certificate is required.')
  const key = knownDevicesKey(certificate.network)
  const saved = storage.getItem(key)
  const devices = saved === null ? [] : JSON.parse(saved)
  if (!Array.isArray(devices)) throw new Error('Saved known chat devices are invalid.')
  const index = devices.findIndex(
    (device) => device.account === certificate.account && device.deviceId === certificate.deviceId
  )
  if (index === -1) devices.push(certificate)
  else devices[index] = certificate
  if (devices.length > KNOWN_DEVICES_LIMIT) devices.splice(0, devices.length - KNOWN_DEVICES_LIMIT)
  storage.setItem(key, JSON.stringify(devices))
  return devices
}
