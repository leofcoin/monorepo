import {
  verifyDeliveryReceipt,
  approveDevice as createDeviceApproval,
  verifyDeviceApproval,
  verifyDeviceCertificate,
  createInboxRequest,
  verifyChatInboxRequest,
  verifyDirectEnvelope,
  verifySpaceEnvelope
} from './chat-security.js'

const VERSION = 1
const DEFAULT_HOPS = 8
const MAX_PACKET_BYTES = 32_000
const MAX_ARCHIVED_MESSAGES = 500
const MAX_OUTBOX_MESSAGES = 500
const MAX_RECEIPTS = 2_000
const MAX_MESSAGE_AGE = 30 * 24 * 60 * 60 * 1000
const MAX_CLOCK_SKEW = 10 * 60 * 1000
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function encodePacket(packet) {
  return encoder.encode(JSON.stringify(packet))
}

function decodePacket(payload) {
  if (!(payload instanceof Uint8Array)) throw new TypeError('Peernet chat payload must be encoded bytes.')
  if (payload.byteLength > MAX_PACKET_BYTES) throw new RangeError('Peernet chat packet is too large.')
  return JSON.parse(decoder.decode(payload))
}

function keyFor(network) {
  return `${network}:leofcoin-chat-transport:v1`
}

function randomId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
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

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateStoredState(value) {
  if (
    !isRecord(value) ||
    value.version !== VERSION ||
    typeof value.archiveEnabled !== 'boolean' ||
    !isRecord(value.archives) ||
    !isRecord(value.outbox) ||
    !isRecord(value.receipts)
  )
    throw new Error('Saved chat transport data is invalid.')
  return value
}

function validateEnvelope(envelope, network, kind) {
  if (!isRecord(envelope) || envelope.version !== VERSION || typeof envelope.id !== 'string' || !envelope.id)
    throw new Error('Chat envelope is invalid.')
  if (!Number.isFinite(envelope.timestamp) || Math.abs(Date.now() - envelope.timestamp) > MAX_MESSAGE_AGE)
    throw new Error('Chat message timestamp is invalid or expired.')
  if (kind === 'direct') {
    if (
      envelope.senderCertificate?.network !== network ||
      envelope.recipientCertificate?.network !== network ||
      envelope.senderAccount !== envelope.senderCertificate.account ||
      envelope.senderDeviceId !== envelope.senderCertificate.deviceId ||
      envelope.recipientAccount !== envelope.recipientCertificate.account ||
      envelope.recipientDeviceId !== envelope.recipientCertificate.deviceId ||
      typeof envelope.ciphertext !== 'string' ||
      typeof envelope.signature !== 'string'
    )
      throw new Error('Direct message envelope is incomplete or belongs to another network.')
  } else if (
    typeof envelope.spaceId !== 'string' ||
    envelope.senderCertificate?.network !== network ||
    typeof envelope.ciphertext !== 'string' ||
    typeof envelope.signature !== 'string'
  ) {
    throw new Error('Space message envelope is incomplete or belongs to another network.')
  }
  if (encoder.encode(JSON.stringify(envelope)).byteLength > MAX_PACKET_BYTES)
    throw new Error('Chat message is too large to send.')
}

export class ChatTransport {
  #peernet
  #network
  #storage
  #topic
  #state
  #seen = new Map()
  #handlers = new Set()
  #started = false
  #unsubscribe
  #timer
  #identityProvider
  #archiveMode
  #unsubscribeArchive

  constructor({ peernet = globalThis.peernet, network, storage = globalThis.localStorage, identityProvider }) {
    if (!peernet || typeof peernet.publish !== 'function' || typeof peernet.subscribe !== 'function')
      throw new Error('Peernet chat transport is unavailable.')
    if (!network || typeof network !== 'string') throw new Error('A chat network is required.')
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
      throw new Error('Persistent chat storage is unavailable.')
    if (typeof identityProvider !== 'function') throw new Error('A device identity provider is required.')

    this.#peernet = peernet
    this.#network = network
    this.#storage = storage
    this.#topic = `leofcoin:chat:v1:${network}`
    this.#identityProvider = identityProvider
    if (typeof peernet.createArchiveMode === 'function') {
      this.#archiveMode = peernet.createArchiveMode({
        verifyEnvelope: (envelope) => verifyDirectEnvelope(envelope, network),
        verifyInboxRequest: (request) => verifyChatInboxRequest(request, network),
        verifyReceipt: (receipt, envelope) => verifyDeliveryReceipt(receipt, envelope)
      })
    }
    const saved = storage.getItem(keyFor(network))
    this.#state = saved === null
      ? { version: VERSION, archiveEnabled: false, archives: {}, outbox: {}, receipts: {} }
      : validateStoredState(JSON.parse(saved))
    this.#prune()
  }

  get archiveEnabled() {
    return this.#archiveMode?.enabled ?? this.#state.archiveEnabled
  }

  get archiveCount() {
    return this.#archiveMode?.archiveCount ?? Object.keys(this.#state.archives).length
  }

  get pendingCount() {
    return this.#archiveMode?.pendingCount ?? Object.keys(this.#state.outbox).length
  }

  subscribe(handler) {
    if (typeof handler !== 'function') throw new TypeError('A chat event handler is required.')
    this.#handlers.add(handler)
    return () => this.#handlers.delete(handler)
  }

  async start() {
    if (this.#started) return
    const receiver = (packet) => {
      this.#receive(packet).catch((error) => console.error('Peernet chat message failed:', error))
    }
    const unsubscribe = await this.#peernet.subscribe(this.#topic, receiver)
    const globalSub = globalThis.globalSub
    this.#unsubscribe = typeof unsubscribe === 'function'
      ? unsubscribe
      : globalSub?.unsubscribe
      ? () => globalSub.unsubscribe(this.#topic, receiver)
      : undefined
    this.#started = true
    try {
      if (this.#archiveMode) {
        const identity = await this.#identityProvider()
        if (!identity?.account || !identity.deviceId || !identity.certificate || !identity.signingKey)
          throw new Error('A complete local device identity is required for Peernet archive mode.')
        if (this.#state.archiveEnabled && !this.#archiveMode.enabled)
          await this.#archiveMode.setEnabled(true)
        this.#unsubscribeArchive = this.#archiveMode.onMessage(({ envelope }) => {
          this.#receiveDirect(envelope).catch((error) => console.error('Peernet archived chat message failed:', error))
        })
        await this.#archiveMode.start({ account: identity.account, deviceId: identity.deviceId })
        this.#state.archiveEnabled = this.#archiveMode.enabled
        this.#save()
        await this.#archiveMode.requestInbox(
          await createInboxRequest({ certificate: identity.certificate, signingKey: identity.signingKey })
        )
      }
      if (this.#state.archiveEnabled) await this.#publish('archive-status', { enabled: true })
      await this.#announceDevice()
      await this.requestInbox()
      this.#timer = setInterval(() => {
        this.requestInbox().catch((error) => console.error('Peernet inbox request failed:', error))
        this.#requestArchiveInbox().catch((error) => console.error('Peernet archive inbox request failed:', error))
        this.#retryOutbox().catch((error) => console.error('Peernet message retry failed:', error))
        this.#announceDevice().catch((error) => console.error('Peernet device announcement failed:', error))
        if (this.#state.archiveEnabled)
          this.#publish('archive-status', { enabled: true }).catch((error) =>
            console.error('Peernet archive announcement failed:', error)
          )
      }, 30_000)
    } catch (error) {
      clearInterval(this.#timer)
      this.#unsubscribe?.()
      this.#unsubscribeArchive?.()
      this.#archiveMode?.stop()
      this.#unsubscribe = undefined
      this.#unsubscribeArchive = undefined
      this.#started = false
      throw error
    }
  }

  stop() {
    if (!this.#started) return
    clearInterval(this.#timer)
    this.#unsubscribe?.()
    this.#unsubscribeArchive?.()
    this.#archiveMode?.stop()
    this.#unsubscribe = undefined
    this.#unsubscribeArchive = undefined
    this.#started = false
  }

  async setArchiveEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw new TypeError('Archive setting must be a boolean.')
    this.#state.archiveEnabled = enabled
    if (!enabled) this.#state.archives = {}
    this.#save()
    await this.#archiveMode?.setEnabled(enabled)
    if (this.#started) await this.#publish('archive-status', { enabled })
  }

  async sendDirect(envelope) {
    validateEnvelope(envelope, this.#network, 'direct')
    if (!(await verifyDirectEnvelope(envelope, this.#network)))
      throw new Error('Direct message signature or device certificates are invalid.')
    if (this.#state.outbox[envelope.id]) throw new Error('This direct message is already pending delivery.')
    this.#state.outbox[envelope.id] = { envelope, createdAt: Date.now() }
    this.#save()
    await this.#archiveMode?.send(envelope)
    await this.#publish('direct', { envelope })
  }

  async sendSpace(envelope) {
    validateEnvelope(envelope, this.#network, 'space')
    if (!(await verifySpaceEnvelope(envelope, this.#network)))
      throw new Error('Space message signature or device certificate is invalid.')
    await this.#publish('space', { envelope })
  }

  async approveDevice({ newCertificate, existingCertificate, signingKey }) {
    const identity = await this.#identityProvider()
    if (
      !identity?.certificate ||
      identity.account !== existingCertificate?.account ||
      identity.deviceId !== existingCertificate?.deviceId ||
      identity.signingKey !== signingKey
    )
      throw new Error('Only this unlocked, trusted device can approve another device.')
    if (!(await verifyDeviceCertificate(newCertificate, this.#network)))
      throw new Error('The requested device certificate is invalid.')
    const approval = await createDeviceApproval({
      existingCertificate,
      existingSigningKey: signingKey,
      newCertificate
    })
    await this.#publish('device-approval', { approval, existingCertificate, newCertificate })
    return { ...newCertificate, approval }
  }

  async requestInbox() {
    const identity = await this.#identityProvider()
    if (!identity?.account || !identity.deviceId || !identity.certificate || !identity.signingKey) return false
    if (!(await verifyDeviceCertificate(identity.certificate, this.#network)))
      throw new Error('The local device certificate is invalid.')
    const payload = {
      version: VERSION,
      id: randomId(),
      account: identity.account,
      deviceId: identity.deviceId,
      certificate: identity.certificate,
      timestamp: Date.now()
    }
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      identity.signingKey,
      encoder.encode(canonical(payload))
    )
    await this.#publish('inbox-request', {
      ...payload,
      signature: this.#toBase64(new Uint8Array(signature))
    })
    return true
  }

  async acknowledgeDelivery(receipt) {
    if (!isRecord(receipt) || receipt.version !== VERSION || typeof receipt.messageId !== 'string')
      throw new Error('Delivery receipt is invalid.')
    await this.#archiveMode?.acknowledge(receipt)
    await this.#publish('delivery-receipt', { receipt })
  }

  async #requestArchiveInbox() {
    if (!this.#archiveMode) return false
    const identity = await this.#identityProvider()
    if (!identity?.certificate || !identity.signingKey) return false
    await this.#archiveMode.requestInbox(
      await createInboxRequest({ certificate: identity.certificate, signingKey: identity.signingKey })
    )
    return true
  }

  async #publish(type, payload, hopsRemaining = DEFAULT_HOPS) {
    const senderPeerId = this.#peernet.id || this.#peernet.peerId
    if (!senderPeerId) throw new Error('Peernet routing peer ID is unavailable.')
    const packet = {
      version: VERSION,
      id: randomId(),
      network: this.#network,
      senderPeerId,
      createdAt: Date.now(),
      hopsRemaining,
      type,
      payload
    }
    if (encoder.encode(JSON.stringify(packet)).byteLength > MAX_PACKET_BYTES)
      throw new Error('Chat network packet is too large.')
    this.#markSeen(packet.id)
    await this.#peernet.publish(this.#topic, encodePacket(packet))
    return packet.id
  }

  async #receive(payload) {
    const packet = decodePacket(payload)
    if (
      !isRecord(packet) ||
      packet.version !== VERSION ||
      packet.network !== this.#network ||
      typeof packet.id !== 'string' ||
      typeof packet.senderPeerId !== 'string' ||
      !Number.isFinite(packet.createdAt) ||
      Date.now() - packet.createdAt > MAX_MESSAGE_AGE ||
      packet.createdAt - Date.now() > MAX_CLOCK_SKEW ||
      !Number.isInteger(packet.hopsRemaining) ||
      packet.hopsRemaining < 0 ||
      packet.hopsRemaining > DEFAULT_HOPS ||
      ![
        'direct',
        'space',
        'inbox-request',
        'archive-delivery',
        'delivery-receipt',
        'archive-status',
        'device-announce',
        'device-approval'
      ].includes(packet.type) ||
      !isRecord(packet.payload) ||
      encoder.encode(JSON.stringify(packet)).byteLength > MAX_PACKET_BYTES
    )
      return
    if (this.#wasSeen(packet.id)) return
    this.#markSeen(packet.id)
    let shouldForward = true
    try {
      switch (packet.type) {
        case 'direct':
          shouldForward = await this.#receiveDirect(packet.payload.envelope)
          break
        case 'space':
          try {
            validateEnvelope(packet.payload.envelope, this.#network, 'space')
            shouldForward = await verifySpaceEnvelope(packet.payload.envelope, this.#network)
          } catch {
            shouldForward = false
          }
          if (shouldForward)
            await this.#emit({ type: 'space', envelope: packet.payload.envelope })
          break
        case 'inbox-request':
          shouldForward = await this.#answerInboxRequest(packet.payload)
          break
        case 'archive-delivery':
          shouldForward = await this.#receiveDirect(packet.payload.envelope)
          break
        case 'delivery-receipt':
          shouldForward = await this.#receiveReceipt(packet.payload.receipt)
          break
        case 'archive-status':
          shouldForward = typeof packet.payload.enabled === 'boolean'
          await this.#emit({
            type: 'archive-status',
            peerId: packet.senderPeerId,
            enabled: packet.payload.enabled === true,
            timestamp: packet.createdAt
          })
          break
        case 'device-announce':
          shouldForward = await verifyDeviceCertificate(packet.payload.certificate, this.#network)
          if (shouldForward) await this.#emit({ type: 'device', certificate: packet.payload.certificate })
          break
        case 'device-approval': {
          const { approval, existingCertificate, newCertificate } = packet.payload
          shouldForward =
            existingCertificate?.network === this.#network &&
            newCertificate?.network === this.#network &&
            (await verifyDeviceCertificate(existingCertificate, this.#network)) &&
            (await verifyDeviceCertificate(newCertificate, this.#network)) &&
            (await verifyDeviceApproval(approval, existingCertificate, newCertificate))
          if (shouldForward)
            await this.#emit({ type: 'device-approval', approval, existingCertificate, newCertificate })
          break
        }
        default:
          break
      }
    } finally {
      if (shouldForward && packet.hopsRemaining > 0) {
        const forwarded = { ...packet, hopsRemaining: packet.hopsRemaining - 1 }
        await this.#peernet.publish(this.#topic, encodePacket(forwarded))
      }
    }
  }

  async #receiveDirect(envelope) {
    try {
      validateEnvelope(envelope, this.#network, 'direct')
    } catch {
      return false
    }
    if (!(await verifyDirectEnvelope(envelope, this.#network))) return false
    if (this.#state.receipts[envelope.id]) {
      const delivered = this.#state.receipts[envelope.id]
      if (await verifyDeliveryReceipt(delivered, envelope)) return true
      delete this.#state.receipts[envelope.id]
    }
    if (this.#state.archiveEnabled && !this.#state.archives[envelope.id]) {
      this.#state.archives[envelope.id] = { envelope, storedAt: Date.now() }
      this.#prune()
      this.#save()
    }
    await this.#emit({ type: 'direct', envelope })
    return true
  }

  async #retryOutbox() {
    for (const { envelope } of Object.values(this.#state.outbox)) {
      if (await verifyDirectEnvelope(envelope, this.#network)) await this.#publish('direct', { envelope })
    }
  }

  async #announceDevice() {
    const identity = await this.#identityProvider()
    if (!identity?.certificate) return false
    if (!(await verifyDeviceCertificate(identity.certificate, this.#network)))
      throw new Error('The local device certificate is invalid.')
    await this.#publish('device-announce', { certificate: identity.certificate })
    return true
  }

  async #answerInboxRequest(request) {
    if (!this.#state.archiveEnabled) return true
    if (
      request?.version !== VERSION ||
      request.certificate?.account !== request.account ||
      request.certificate?.deviceId !== request.deviceId ||
      request.certificate?.network !== this.#network ||
      !Number.isFinite(request.timestamp) ||
      Math.abs(Date.now() - request.timestamp) > MAX_CLOCK_SKEW ||
      !(await verifyDeviceCertificate(request.certificate, this.#network))
    )
      return false
    const { signature, ...payload } = request
    let valid = false
    try {
      const publicKey = await crypto.subtle.importKey(
        'raw',
        this.#fromBase64(request.certificate.signingKey),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      )
      valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        this.#fromBase64(signature),
        encoder.encode(canonical(payload))
      )
    } catch {
      return false
    }
    if (!valid) return false

    const identity = await this.#identityProvider()
    if (identity?.account === request.account && identity.deviceId === request.deviceId) return true
    for (const [messageId, record] of Object.entries(this.#state.archives)) {
      const envelope = record.envelope
      if (envelope.recipientAccount !== request.account || envelope.recipientDeviceId !== request.deviceId) continue
      await this.#publish('archive-delivery', { envelope })
      await this.#emit({ type: 'archive-request-served', messageId })
    }
    return true
  }

  async #receiveReceipt(receipt) {
    if (!isRecord(receipt) || typeof receipt.messageId !== 'string') return false
    const archived = this.#state.archives[receipt.messageId]
    const outgoing = this.#state.outbox[receipt.messageId]
    const envelope = archived?.envelope || outgoing?.envelope
    if (!envelope || !(await verifyDeliveryReceipt(receipt, envelope))) return false

    this.#state.receipts[receipt.messageId] = receipt
    delete this.#state.archives[receipt.messageId]
    delete this.#state.outbox[receipt.messageId]
    this.#prune()
    this.#save()
    await this.#emit({ type: 'delivered', messageId: receipt.messageId, receipt })
    return true
  }

  async #emit(event) {
    for (const handler of this.#handlers) await handler(event)
  }

  #wasSeen(id) {
    const timestamp = this.#seen.get(id)
    return timestamp !== undefined && Date.now() - timestamp < MAX_MESSAGE_AGE
  }

  #markSeen(id) {
    this.#seen.set(id, Date.now())
    if (this.#seen.size > 4_000) this.#seen.delete(this.#seen.keys().next().value)
  }

  #prune() {
    const cutoff = Date.now() - MAX_MESSAGE_AGE
    for (const [id, record] of Object.entries(this.#state.archives))
      if (record?.storedAt < cutoff) delete this.#state.archives[id]
    for (const [id, record] of Object.entries(this.#state.outbox))
      if (record?.createdAt < cutoff) delete this.#state.outbox[id]
    for (const [id, receipt] of Object.entries(this.#state.receipts))
      if (receipt?.timestamp < cutoff) delete this.#state.receipts[id]
    for (const records of [this.#state.archives, this.#state.outbox, this.#state.receipts]) {
      const maximum =
        records === this.#state.archives ? MAX_ARCHIVED_MESSAGES :
        records === this.#state.outbox ? MAX_OUTBOX_MESSAGES : MAX_RECEIPTS
      const excess = Object.keys(records).length - maximum
      if (excess > 0) {
        for (const id of Object.keys(records).slice(0, excess)) delete records[id]
      }
    }
  }

  #save() {
    this.#storage.setItem(keyFor(this.#network), JSON.stringify(this.#state))
  }

  #toBase64(bytes) {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }

  #fromBase64(value) {
    if (typeof value !== 'string') throw new Error('Chat signature encoding is invalid.')
    const binary = atob(value)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  }
}

export function createChatTransport(options) {
  return new ChatTransport(options)
}
