import MultiWallet from '@leofcoin/multi-wallet'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const ECDH = { name: 'ECDH', namedCurve: 'P-256' }
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' }

function encodeBase64(value) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonical(value))))
}

function certificatePayload(certificate) {
  const { signature, approval, ...payload } = certificate
  return payload
}

function envelopePayload(envelope) {
  const { signature, ...payload } = envelope
  return payload
}

export async function createDeviceKeys() {
  const [encryption, signing] = await Promise.all([
    crypto.subtle.generateKey(ECDH, false, ['deriveKey']),
    crypto.subtle.generateKey(ECDSA, false, ['sign', 'verify'])
  ])
  return {
    encryption: {
      privateKey: encryption.privateKey,
      publicKey: new Uint8Array(await crypto.subtle.exportKey('raw', encryption.publicKey))
    },
    signing: {
      privateKey: signing.privateKey,
      publicKey: new Uint8Array(await crypto.subtle.exportKey('raw', signing.publicKey))
    }
  }
}

export async function createDeviceCertificate({ account, network, deviceId, keys, signWithAccount }) {
  if (!account || !network || !deviceId || !keys?.encryption?.publicKey || !keys?.signing?.publicKey)
    throw new Error('Account, network, device ID and device keys are required.')
  if (typeof signWithAccount !== 'function') throw new Error('An unlocked account signer is required.')
  const payload = {
    version: 1,
    account,
    network,
    deviceId,
    encryptionKey: encodeBase64(keys.encryption.publicKey),
    signingKey: encodeBase64(keys.signing.publicKey)
  }
  const signature = await signWithAccount(await digest(payload))
  return { ...payload, signature: encodeBase64(signature) }
}

export async function verifyDeviceCertificate(certificate, network) {
  if (
    certificate?.version !== 1 ||
    certificate.network !== network ||
    typeof certificate.account !== 'string' ||
    typeof certificate.deviceId !== 'string' ||
    typeof certificate.encryptionKey !== 'string' ||
    typeof certificate.signingKey !== 'string' ||
    typeof certificate.signature !== 'string'
  )
    return false

  try {
    const verifier = new MultiWallet(network)
    await verifier.fromAddress(certificate.account, null, network)
    return await verifier.verify(decodeBase64(certificate.signature), await digest(certificatePayload(certificate)))
  } catch {
    return false
  }
}

export async function approveDevice({ existingCertificate, existingSigningKey, newCertificate }) {
  if (!existingCertificate || !existingSigningKey || !newCertificate)
    throw new Error('Existing device keys and the new device certificate are required.')
  if (
    existingCertificate.account !== newCertificate.account ||
    existingCertificate.network !== newCertificate.network ||
    newCertificate.version !== 1
  )
    throw new Error('Devices must belong to the same account and network.')
  const payload = {
    version: 1,
    account: newCertificate.account,
    network: newCertificate.network,
    approvedDeviceId: newCertificate.deviceId,
    approvedEncryptionKey: newCertificate.encryptionKey,
    approvedSigningKey: newCertificate.signingKey,
    approverDeviceId: existingCertificate.deviceId,
    approverSigningKey: existingCertificate.signingKey
  }
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    existingSigningKey,
    encoder.encode(canonical(payload))
  )
  return { ...payload, signature: encodeBase64(new Uint8Array(signature)) }
}

export async function verifyDeviceApproval(approval, existingCertificate, newCertificate) {
  if (
    !approval ||
    !existingCertificate ||
    !newCertificate ||
    approval.account !== newCertificate.account ||
    approval.network !== newCertificate.network ||
    approval.approvedDeviceId !== newCertificate.deviceId ||
    approval.approvedEncryptionKey !== newCertificate.encryptionKey ||
    approval.approvedSigningKey !== newCertificate.signingKey ||
    approval.approverDeviceId !== existingCertificate.deviceId ||
    approval.approverSigningKey !== existingCertificate.signingKey
  )
    return false

  const { signature, ...payload } = approval
  try {
    const publicKey = await crypto.subtle.importKey('raw', decodeBase64(existingCertificate.signingKey), ECDSA, false, [
      'verify'
    ])
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      decodeBase64(signature),
      encoder.encode(canonical(payload))
    )
  } catch {
    return false
  }
}

export async function isTrustedChatDevice(certificate, trustedCertificates, network) {
  if (!(await verifyDeviceCertificate(certificate, network))) return false
  for (const trusted of trustedCertificates || []) {
    if (
      trusted.account === certificate.account &&
      trusted.network === certificate.network &&
      trusted.deviceId === certificate.deviceId &&
      trusted.signingKey === certificate.signingKey &&
      trusted.encryptionKey === certificate.encryptionKey
    )
      return true
    if (
      trusted.account === certificate.account &&
      trusted.network === certificate.network &&
      (await verifyDeviceApproval(certificate.approval, trusted, certificate))
    )
      return true
  }
  return false
}

async function verifyEnvelopeSignature(envelope, certificate, network) {
  if (!(await verifyDeviceCertificate(certificate, network))) return false
  try {
    const publicKey = await crypto.subtle.importKey('raw', decodeBase64(certificate.signingKey), ECDSA, false, [
      'verify'
    ])
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      decodeBase64(envelope.signature),
      encoder.encode(canonical(envelopePayload(envelope)))
    )
  } catch {
    return false
  }
}

export async function verifyDirectEnvelope(envelope, network) {
  if (
    envelope?.version !== 1 ||
    typeof envelope.id !== 'string' ||
    !Number.isFinite(envelope.timestamp) ||
    envelope.senderCertificate?.account !== envelope.senderAccount ||
    envelope.senderCertificate?.deviceId !== envelope.senderDeviceId ||
    envelope.recipientCertificate?.account !== envelope.recipientAccount ||
    envelope.recipientCertificate?.deviceId !== envelope.recipientDeviceId ||
    envelope.senderCertificate?.network !== network ||
    envelope.recipientCertificate?.network !== network ||
    typeof envelope.ciphertext !== 'string' ||
    typeof envelope.signature !== 'string'
  )
    return false
  return (
    (await verifyEnvelopeSignature(envelope, envelope.senderCertificate, network)) &&
    (await verifyDeviceCertificate(envelope.recipientCertificate, network))
  )
}

export async function verifySpaceEnvelope(envelope, network) {
  if (
    envelope?.version !== 1 ||
    typeof envelope.id !== 'string' ||
    !Number.isFinite(envelope.timestamp) ||
    typeof envelope.spaceId !== 'string' ||
    !envelope.spaceId ||
    envelope.senderCertificate?.account !== envelope.senderAccount ||
    envelope.senderCertificate?.deviceId !== envelope.senderDeviceId ||
    envelope.senderCertificate?.network !== network ||
    typeof envelope.ciphertext !== 'string' ||
    typeof envelope.signature !== 'string'
  )
    return false
  return verifyEnvelopeSignature(envelope, envelope.senderCertificate, network)
}

async function deriveMessageKey(privateKey, publicKeyBytes) {
  const publicKey = await crypto.subtle.importKey('raw', publicKeyBytes, ECDH, false, [])
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function sealDirectMessage({
  id,
  text,
  sender,
  senderCertificate,
  senderSigningKey,
  recipient,
  recipientCertificate,
  recipientEncryptionKey
}) {
  const message = String(text ?? '').trim()
  if (!message) throw new Error('Enter a message.')
  if (message.length > 4000) throw new Error('Messages must be 4,000 characters or fewer.')
  if (!id || !sender?.account || !sender?.deviceId || !recipient?.account || !recipient?.deviceId)
    throw new Error('Message and device identities are required.')
  if (
    senderCertificate?.account !== sender.account ||
    senderCertificate?.deviceId !== sender.deviceId ||
    !senderSigningKey ||
    senderCertificate.network !== recipient.network ||
    recipientCertificate?.account !== recipient.account ||
    recipientCertificate?.deviceId !== recipient.deviceId ||
    recipientCertificate?.network !== recipient.network ||
    !(recipientEncryptionKey instanceof Uint8Array) ||
    recipientEncryptionKey.length !== 65 ||
    recipientCertificate.encryptionKey !== encodeBase64(recipientEncryptionKey)
  )
    throw new Error('A matching sender certificate, signing key and P-256 recipient key are required.')

  const ephemeral = await crypto.subtle.generateKey(ECDH, true, ['deriveKey'])
  const ephemeralPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))
  const key = await deriveMessageKey(ephemeral.privateKey, recipientEncryptionKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const payload = {
    version: 1,
    id,
    timestamp: Date.now(),
    senderAccount: sender.account,
    senderDeviceId: sender.deviceId,
    recipientAccount: recipient.account,
    recipientDeviceId: recipient.deviceId,
    senderCertificate,
    recipientCertificate,
    ephemeralPublicKey: encodeBase64(ephemeralPublicKey),
    iv: encodeBase64(iv)
  }
  const additionalData = encoder.encode(canonical(payload))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, encoder.encode(message))
  )
  const unsignedEnvelope = { ...payload, ciphertext: encodeBase64(ciphertext) }
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    senderSigningKey,
    encoder.encode(canonical(unsignedEnvelope))
  )
  return { ...unsignedEnvelope, signature: encodeBase64(new Uint8Array(signature)) }
}

export async function openDirectMessage({
  envelope,
  recipientAccount,
  recipientDeviceId,
  recipientPrivateKey,
  network,
  trustedCertificates
}) {
  if (
    envelope?.version !== 1 ||
    envelope.recipientAccount !== recipientAccount ||
    envelope.recipientDeviceId !== recipientDeviceId ||
    envelope.recipientCertificate?.account !== recipientAccount ||
    envelope.recipientCertificate?.deviceId !== recipientDeviceId ||
    envelope.recipientCertificate?.network !== network
  )
    throw new Error('This message is not addressed to this device.')
  if (!(await verifyDeviceCertificate(envelope.recipientCertificate, network)))
    throw new Error('The recipient device certificate is invalid.')
  if (!(await isTrustedChatDevice(envelope.senderCertificate, trustedCertificates, network)))
    throw new Error('The sender device is not approved for this account.')
  if (
    envelope.senderCertificate?.account !== envelope.senderAccount ||
    envelope.senderCertificate?.deviceId !== envelope.senderDeviceId ||
    envelope.senderCertificate?.network !== network
  )
    throw new Error('The sender device certificate does not match the message.')

  if (!(await verifyDirectEnvelope(envelope, network))) throw new Error('Message signature is invalid.')
  const payload = envelopePayload(envelope)
  const key = await deriveMessageKey(recipientPrivateKey, decodeBase64(envelope.ephemeralPublicKey))
  const authenticatedPayload = { ...payload }
  delete authenticatedPayload.ciphertext
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64(envelope.iv),
      additionalData: encoder.encode(canonical(authenticatedPayload))
    },
    key,
    decodeBase64(envelope.ciphertext)
  )
  return {
    id: envelope.id,
    timestamp: envelope.timestamp,
    sender: { address: envelope.senderAccount, deviceId: envelope.senderDeviceId },
    recipient: { address: envelope.recipientAccount, deviceId: envelope.recipientDeviceId },
    text: decoder.decode(plaintext)
  }
}

export async function createDeliveryReceipt({ messageId, recipientCertificate, signingKey }) {
  if (!messageId || !recipientCertificate?.account || !recipientCertificate?.deviceId || !signingKey)
    throw new Error('A message ID and recipient device signing key are required.')
  const payload = {
    version: 1,
    messageId,
    recipientAccount: recipientCertificate.account,
    recipientDeviceId: recipientCertificate.deviceId,
    network: recipientCertificate.network,
    timestamp: Date.now()
  }
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    encoder.encode(canonical(payload))
  )
  return { ...payload, signature: encodeBase64(new Uint8Array(signature)) }
}

export async function verifyDeliveryReceipt(receipt, envelope) {
  if (
    receipt?.version !== 1 ||
    receipt.messageId !== envelope?.id ||
    receipt.recipientAccount !== envelope?.recipientAccount ||
    receipt.recipientDeviceId !== envelope?.recipientDeviceId ||
    (receipt.network !== undefined && receipt.network !== envelope?.recipientCertificate?.network) ||
    envelope.recipientCertificate?.account !== receipt.recipientAccount ||
    envelope.recipientCertificate?.deviceId !== receipt.recipientDeviceId ||
    typeof receipt.signature !== 'string'
  )
    return false
  if (!(await verifyDeviceCertificate(envelope.recipientCertificate, envelope.recipientCertificate.network)))
    return false
  const { signature, ...payload } = receipt
  try {
    const publicKey = await crypto.subtle.importKey(
      'raw',
      decodeBase64(envelope.recipientCertificate.signingKey),
      ECDSA,
      false,
      ['verify']
    )
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      decodeBase64(signature),
      encoder.encode(canonical(payload))
    )
  } catch {
    return false
  }
}

export async function createInboxRequest({ certificate, signingKey }) {
  if (!certificate?.account || !certificate?.deviceId || !certificate?.network || !signingKey)
    throw new Error('A device certificate and signing key are required for an inbox request.')
  const payload = {
    version: 1,
    network: certificate.network,
    account: certificate.account,
    deviceId: certificate.deviceId,
    certificate,
    timestamp: Date.now()
  }
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    encoder.encode(canonical(payload))
  )
  return { ...payload, signature: encodeBase64(new Uint8Array(signature)) }
}

export async function verifyChatInboxRequest(request, network) {
  if (
    request?.version !== 1 ||
    request.network !== network ||
    request.account !== request.certificate?.account ||
    request.deviceId !== request.certificate?.deviceId ||
    request.certificate?.network !== network ||
    typeof request.signature !== 'string' ||
    !Number.isFinite(request.timestamp) ||
    Math.abs(Date.now() - request.timestamp) > 10 * 60 * 1000 ||
    !(await verifyDeviceCertificate(request.certificate, network))
  )
    return false
  const { signature, ...payload } = request
  try {
    const publicKey = await crypto.subtle.importKey(
      'raw',
      decodeBase64(request.certificate.signingKey),
      ECDSA,
      false,
      ['verify']
    )
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      decodeBase64(signature),
      encoder.encode(canonical(payload))
    )
  } catch {
    return false
  }
}

export function createSpaceKey() {
  return crypto.getRandomValues(new Uint8Array(32))
}

async function importSpaceKey(spaceKey, usage) {
  if (spaceKey instanceof Uint8Array && spaceKey.length === 32)
    return crypto.subtle.importKey('raw', spaceKey, { name: 'AES-GCM' }, false, [usage])
  if (
    typeof CryptoKey !== 'undefined' &&
    spaceKey instanceof CryptoKey &&
    spaceKey.algorithm.name === 'AES-GCM' &&
    spaceKey.algorithm.length === 256 &&
    spaceKey.usages.includes(usage)
  )
    return spaceKey
  throw new Error('A valid 32-byte Space key is required.')
}

export async function sealSpaceMessage({ id, spaceId, text, sender, certificate, signingKey, spaceKey }) {
  const message = String(text ?? '').trim()
  if (!message) throw new Error('Enter a message.')
  if (message.length > 4000) throw new Error('Messages must be 4,000 characters or fewer.')
  if (
    !id ||
    !spaceId ||
    sender?.account !== certificate?.account ||
    sender?.deviceId !== certificate?.deviceId ||
    !signingKey ||
    !spaceKey
  )
    throw new Error('A valid Space, sender device and Space key are required.')

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await importSpaceKey(spaceKey, 'encrypt')
  const payload = {
    version: 1,
    id,
    spaceId,
    timestamp: Date.now(),
    senderAccount: sender.account,
    senderDeviceId: sender.deviceId,
    senderCertificate: certificate,
    iv: encodeBase64(iv)
  }
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: encoder.encode(canonical(payload)) },
      key,
      encoder.encode(message)
    )
  )
  const unsignedEnvelope = { ...payload, ciphertext: encodeBase64(ciphertext) }
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    encoder.encode(canonical(unsignedEnvelope))
  )
  return { ...unsignedEnvelope, signature: encodeBase64(new Uint8Array(signature)) }
}

export async function openSpaceMessage({ envelope, spaceId, spaceKey, network, trustedCertificates }) {
  if (envelope?.version !== 1 || envelope.spaceId !== spaceId)
    throw new Error('This message belongs to a different Space.')
  const key = await importSpaceKey(spaceKey, 'decrypt')
  if (!(await isTrustedChatDevice(envelope.senderCertificate, trustedCertificates, network)))
    throw new Error('The sender device is not approved for this account.')
  if (
    envelope.senderCertificate?.account !== envelope.senderAccount ||
    envelope.senderCertificate?.deviceId !== envelope.senderDeviceId ||
    envelope.senderCertificate?.network !== network
  )
    throw new Error('The sender device certificate does not match the message.')

  const unsignedEnvelope = envelopePayload(envelope)
  const publicKey = await crypto.subtle.importKey(
    'raw',
    decodeBase64(envelope.senderCertificate.signingKey),
    ECDSA,
    false,
    ['verify']
  )
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    decodeBase64(envelope.signature),
    encoder.encode(canonical(unsignedEnvelope))
  )
  if (!valid) throw new Error('Message signature is invalid.')

  const authenticatedPayload = { ...unsignedEnvelope }
  delete authenticatedPayload.ciphertext
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64(envelope.iv),
      additionalData: encoder.encode(canonical(authenticatedPayload))
    },
    key,
    decodeBase64(envelope.ciphertext)
  )
  return {
    id: envelope.id,
    timestamp: envelope.timestamp,
    spaceId: envelope.spaceId,
    sender: { address: envelope.senderAccount, deviceId: envelope.senderDeviceId },
    text: decoder.decode(plaintext)
  }
}
