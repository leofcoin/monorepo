import assert from 'node:assert/strict'
import test from 'node:test'
import generateAccount from '@leofcoin/generate-account'
import IdentityController from '../src/controllers/identity.ts'
import { createChatTransport } from '../src/controllers/chat-transport.js'
import { listKnownChatDevices, rememberChatDevice } from '../src/controllers/chat-device-store.js'
import {
  approveDevice,
  createDeviceCertificate,
  createDeviceKeys,
  createDeliveryReceipt,
  createInboxRequest,
  createSpaceKey,
  isTrustedChatDevice,
  openDirectMessage,
  openSpaceMessage,
  sealDirectMessage,
  sealSpaceMessage,
  verifyDeviceApproval,
  verifyChatInboxRequest,
  verifyDeviceCertificate,
  verifyDeliveryReceipt
} from '../src/controllers/chat-security.js'

const network = 'leofcoin:peach'

class MemoryStorage {
  #values = new Map()

  getItem(key) {
    return this.#values.get(key) ?? null
  }

  setItem(key, value) {
    this.#values.set(key, String(value))
  }
}

function createPeer(peerId) {
  const listeners = new Map()
  const connections = new Set()
  return {
    peerId,
    listeners,
    connections,
    published: [],
    async subscribe(topic, handler) {
      const handlers = listeners.get(topic) || new Set()
      handlers.add(handler)
      listeners.set(topic, handlers)
      return () => handlers.delete(handler)
    },
    async publish(topic, packet) {
      this.published.push({ topic, packet: Uint8Array.from(packet) })
      for (const peer of connections) {
        for (const handler of peer.listeners.get(topic) || []) {
          setTimeout(() => handler(packet), 0)
        }
      }
    }
  }
}

function connectPeers(left, right) {
  left.connections.add(right)
  right.connections.add(left)
}

const waitForNetwork = () => new Promise((resolve) => setTimeout(resolve, 50))

async function setupDevice(wallet, deviceId) {
  globalThis.walletStore = {
    get: async () => new TextEncoder().encode(JSON.stringify(wallet.accounts))
  }
  const keys = await createDeviceKeys()
  const identity = new IdentityController(network, wallet)
  await identity.unlock('chat-security-test-password')
  const account = wallet.accounts[0][1]
  const signer = await identity.signer(account)
  const certificate = await createDeviceCertificate({
    account,
    network,
    deviceId,
    keys,
    signWithAccount: signer.sign
  })
  return {
    account,
    deviceId,
    keys,
    certificate,
    identity,
    signingKey: keys.signing.privateKey,
    encryptionPrivateKey: keys.encryption.privateKey
  }
}

test('creates wallet-bound device certificates and requires explicit device approval', async () => {
  const wallet = await generateAccount('chat-security-test-password', network)
  const existing = await setupDevice(wallet, 'device-one')
  const requested = await setupDevice(wallet, 'device-two')

  assert.equal(await verifyDeviceCertificate(existing.certificate, network), true)
  assert.equal(await verifyDeviceCertificate(requested.certificate, network), true)
  assert.equal(await isTrustedChatDevice(requested.certificate, [existing.certificate], network), false)

  const approval = await approveDevice({
    existingCertificate: existing.certificate,
    existingSigningKey: existing.keys.signing.privateKey,
    newCertificate: requested.certificate
  })
  assert.equal(await verifyDeviceApproval(approval, existing.certificate, requested.certificate), true)
  assert.equal(
    await isTrustedChatDevice({ ...requested.certificate, approval }, [existing.certificate], network),
    true
  )
  assert.equal(
    await verifyDeviceApproval(
      { ...approval, approvedDeviceId: 'unapproved-device' },
      existing.certificate,
      requested.certificate
    ),
    false
  )
  assert.equal(await verifyDeviceCertificate({ ...requested.certificate, network: 'leofcoin:mainnet' }, network), false)
})

test('remembers verified chat devices for offline addressing without marking them trusted', async () => {
  const wallet = await generateAccount('chat-security-test-password', network)
  const device = await setupDevice(wallet, 'known-device')
  const storage = new MemoryStorage()

  assert.deepEqual(rememberChatDevice(device.certificate, storage), [device.certificate])
  assert.deepEqual(listKnownChatDevices(network, storage), [device.certificate])
  assert.equal(await isTrustedChatDevice(device.certificate, [], network), false)
})

test('can retry Peernet subscription after startup fails', async () => {
  let attempts = 0
  const transport = createChatTransport({
    peernet: {
      peerId: 'retrying-node',
      async subscribe() {
        attempts += 1
        if (attempts === 1) throw new Error('temporary subscription error')
        return () => {}
      },
      async publish() {}
    },
    network,
    storage: new MemoryStorage(),
    identityProvider: async () => undefined
  })

  await assert.rejects(transport.start(), /temporary subscription error/)
  await transport.start()
  assert.equal(attempts, 2)
  transport.stop()
})

test('uses Peernet archive mode for signed inbox requests, delivery and receipts', async () => {
  const sender = await setupDevice(await generateAccount('chat-security-test-password', network), 'sender-device')
  const recipient = await setupDevice(await generateAccount('chat-security-test-password', network), 'recipient-device')
  const peer = createPeer('native-archive-peer')
  const calls = { enabled: [], sent: [], receipts: [], inboxRequests: [] }
  let archiveOptions
  const archiveMode = {
    enabled: false,
    archiveCount: 2,
    pendingCount: 1,
    onMessage(handler) {
      this.handler = handler
      return () => {
        this.handler = undefined
      }
    },
    async start(identity) {
      assert.deepEqual(identity, { account: recipient.account, deviceId: recipient.deviceId })
    },
    async requestInbox(request) {
      assert.equal(await verifyChatInboxRequest(request, network), true)
      calls.inboxRequests.push(request)
    },
    async setEnabled(enabled) {
      this.enabled = enabled
      calls.enabled.push(enabled)
    },
    async send(envelope) {
      calls.sent.push(envelope)
    },
    async acknowledge(receipt) {
      calls.receipts.push(receipt)
    },
    stop() {}
  }
  peer.createArchiveMode = (options) => {
    archiveOptions = options
    assert.equal(typeof options.verifyEnvelope, 'function')
    assert.equal(typeof options.verifyInboxRequest, 'function')
    assert.equal(typeof options.verifyReceipt, 'function')
    return archiveMode
  }
  const transport = createChatTransport({
    peernet: peer,
    network,
    storage: new MemoryStorage(),
    identityProvider: async () => ({
      account: recipient.account,
      deviceId: recipient.deviceId,
      certificate: recipient.certificate,
      signingKey: recipient.signingKey
    })
  })
  await transport.start()
  assert.equal(calls.inboxRequests.length, 1)
  assert.equal(transport.archiveCount, 2)
  assert.equal(transport.pendingCount, 1)

  await transport.setArchiveEnabled(true)
  assert.deepEqual(calls.enabled, [true])
  const envelope = await sealDirectMessage({
    id: 'native-archive-send',
    text: 'Encrypted delivery',
    sender: { account: sender.account, deviceId: sender.deviceId },
    senderCertificate: sender.certificate,
    senderSigningKey: sender.signingKey,
    recipient: { account: recipient.account, deviceId: recipient.deviceId, network },
    recipientCertificate: recipient.certificate,
    recipientEncryptionKey: recipient.keys.encryption.publicKey
  })
  assert.equal(await archiveOptions.verifyEnvelope(envelope), true)
  await transport.sendDirect(envelope)
  assert.deepEqual(calls.sent, [envelope])

  const receipt = await createDeliveryReceipt({
    messageId: envelope.id,
    recipientCertificate: recipient.certificate,
    signingKey: recipient.signingKey
  })
  assert.equal(await archiveOptions.verifyReceipt(receipt, envelope), true)
  await transport.acknowledgeDelivery(receipt)
  assert.deepEqual(calls.receipts, [receipt])
  transport.stop()
})

test('encrypts Space messages for members with the Space key', async () => {
  const wallet = await generateAccount('chat-security-test-password', network)
  const sender = await setupDevice(wallet, 'space-member-device')
  const spaceKey = createSpaceKey()
  const envelope = await sealSpaceMessage({
    id: 'space-message-1',
    spaceId: 'space-1',
    text: 'Members only',
    sender: { account: sender.account, deviceId: sender.certificate.deviceId },
    certificate: sender.certificate,
    signingKey: sender.keys.signing.privateKey,
    spaceKey
  })

  const opened = await openSpaceMessage({
    envelope,
    spaceId: 'space-1',
    spaceKey,
    network,
    trustedCertificates: [sender.certificate]
  })
  assert.equal(opened.text, 'Members only')

  const nonExportableKey = await crypto.subtle.importKey(
    'raw',
    spaceKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
  const protectedEnvelope = await sealSpaceMessage({
    id: 'space-message-2',
    spaceId: 'space-1',
    text: 'Protected key object',
    sender: { account: sender.account, deviceId: sender.certificate.deviceId },
    certificate: sender.certificate,
    signingKey: sender.keys.signing.privateKey,
    spaceKey: nonExportableKey
  })
  assert.equal(
    (await openSpaceMessage({
      envelope: protectedEnvelope,
      spaceId: 'space-1',
      spaceKey: nonExportableKey,
      network,
      trustedCertificates: [sender.certificate]
    })).text,
    'Protected key object'
  )

  await assert.rejects(
    openSpaceMessage({
      envelope,
      spaceId: 'space-1',
      spaceKey: createSpaceKey(),
      network,
      trustedCertificates: [sender.certificate]
    })
  )
})

test('invites a Space member over encrypted DM and exchanges encrypted Space messages live', async () => {
  const aliceWallet = await generateAccount('chat-security-test-password', network)
  const bobWallet = await generateAccount('chat-security-test-password', network)
  const alice = await setupDevice(aliceWallet, 'space-owner-device')
  const bob = await setupDevice(bobWallet, 'space-member-device')
  const alicePeer = createPeer('space-owner-peer')
  const bobPeer = createPeer('space-member-peer')
  connectPeers(alicePeer, bobPeer)
  const aliceTransport = createChatTransport({
    peernet: alicePeer,
    network,
    storage: new MemoryStorage(),
    identityProvider: async () => ({
      account: alice.account,
      deviceId: alice.deviceId,
      certificate: alice.certificate,
      signingKey: alice.signingKey
    })
  })
  const bobTransport = createChatTransport({
    peernet: bobPeer,
    network,
    storage: new MemoryStorage(),
    identityProvider: async () => ({
      account: bob.account,
      deviceId: bob.deviceId,
      certificate: bob.certificate,
      signingKey: bob.signingKey
    })
  })
  const bobEvents = []
  bobTransport.subscribe((event) => bobEvents.push(event))
  await aliceTransport.start()
  await bobTransport.start()

  const spaceId = 'space-e2e'
  const spaceName = 'Today'
  const spaceKey = createSpaceKey()
  const invite = `LFCSPACE1:${btoa(
    JSON.stringify({
      version: 1,
      spaceId,
      name: spaceName,
      ownerAccount: alice.account,
      key: btoa(String.fromCharCode(...spaceKey))
    })
  )}`
  const inviteEnvelope = await sealDirectMessage({
    id: 'space-invitation-e2e',
    text: invite,
    sender: { account: alice.account, deviceId: alice.deviceId },
    senderCertificate: alice.certificate,
    senderSigningKey: alice.signingKey,
    recipient: { account: bob.account, deviceId: bob.deviceId, network },
    recipientCertificate: bob.certificate,
    recipientEncryptionKey: bob.keys.encryption.publicKey
  })
  await aliceTransport.sendDirect(inviteEnvelope)
  await waitForNetwork()
  const receivedInvite = bobEvents.find((event) => event.type === 'direct')?.envelope
  assert.ok(receivedInvite, 'member receives the encrypted invitation over Peernet')
  const openedInvite = await openDirectMessage({
    envelope: receivedInvite,
    recipientAccount: bob.account,
    recipientDeviceId: bob.deviceId,
    recipientPrivateKey: bob.encryptionPrivateKey,
    network,
    trustedCertificates: [alice.certificate]
  })
  assert.equal(openedInvite.text, invite)

  const spaceEnvelope = await sealSpaceMessage({
    id: 'space-message-e2e',
    spaceId,
    text: 'Encrypted message for Space members',
    sender: { account: alice.account, deviceId: alice.deviceId },
    certificate: alice.certificate,
    signingKey: alice.signingKey,
    spaceKey
  })
  await aliceTransport.sendSpace(spaceEnvelope)
  await waitForNetwork()
  const receivedSpace = bobEvents.find((event) => event.type === 'space')?.envelope
  assert.ok(receivedSpace, 'member receives the encrypted Space message over Peernet')
  const openedSpace = await openSpaceMessage({
    envelope: receivedSpace,
    spaceId,
    spaceKey,
    network,
    trustedCertificates: [alice.certificate]
  })
  assert.equal(openedSpace.text, 'Encrypted message for Space members')
  assert.ok(
    alicePeer.published.every(({ packet }) => !new TextDecoder().decode(packet).includes(openedSpace.text)),
    'Space plaintext is never published to Peernet'
  )
  aliceTransport.stop()
  bobTransport.stop()
})

test('encrypts direct messages to one approved device and rejects tampering or unapproved senders', async () => {
  const wallet = await generateAccount('chat-security-test-password', network)
  const sender = await setupDevice(wallet, 'sender-device')
  const recipient = await setupDevice(wallet, 'recipient-device')
  const envelope = await sealDirectMessage({
    id: 'message-1',
    text: 'Private message',
    sender: { account: sender.account, deviceId: sender.certificate.deviceId },
    senderCertificate: sender.certificate,
    senderSigningKey: sender.keys.signing.privateKey,
    recipient: { account: recipient.account, deviceId: recipient.certificate.deviceId, network },
    recipientCertificate: recipient.certificate,
    recipientEncryptionKey: recipient.keys.encryption.publicKey
  })

  const opened = await openDirectMessage({
    envelope,
    recipientAccount: recipient.account,
    recipientDeviceId: recipient.certificate.deviceId,
    recipientPrivateKey: recipient.keys.encryption.privateKey,
    network,
    trustedCertificates: [sender.certificate]
  })
  assert.equal(opened.text, 'Private message')
  assert.equal(opened.sender.deviceId, 'sender-device')

  const receipt = await createDeliveryReceipt({
    messageId: envelope.id,
    recipientCertificate: recipient.certificate,
    signingKey: recipient.keys.signing.privateKey
  })
  assert.equal(await verifyDeliveryReceipt(receipt, envelope), true)
  assert.equal(await verifyDeliveryReceipt({ ...receipt, recipientDeviceId: 'other-device' }, envelope), false)
  assert.equal(await verifyDeliveryReceipt({ ...receipt, network: 'leofcoin:mainnet' }, envelope), false)

  const inboxRequest = await createInboxRequest({
    certificate: recipient.certificate,
    signingKey: recipient.keys.signing.privateKey
  })
  assert.equal(await verifyChatInboxRequest(inboxRequest, network), true)
  assert.equal(await verifyChatInboxRequest({ ...inboxRequest, network: 'leofcoin:mainnet' }, network), false)
  assert.equal(
    await verifyChatInboxRequest({ ...inboxRequest, deviceId: 'another-device' }, network),
    false
  )

  await assert.rejects(
    openDirectMessage({
      envelope: { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -4)}AAAA` },
      recipientAccount: recipient.account,
      recipientDeviceId: recipient.certificate.deviceId,
      recipientPrivateKey: recipient.keys.encryption.privateKey,
      network,
      trustedCertificates: [sender.certificate]
    }),
    /signature is invalid/
  )
  await assert.rejects(
    openDirectMessage({
      envelope,
      recipientAccount: recipient.account,
      recipientDeviceId: recipient.certificate.deviceId,
      recipientPrivateKey: recipient.keys.encryption.privateKey,
      network,
      trustedCertificates: []
    }),
    /not approved/
  )
})

test('routes encrypted DMs through opt-in archives and deletes them after a signed receipt', async (t) => {
  const wallet = await generateAccount('chat-security-test-password', network)
  const sender = await setupDevice(wallet, 'sender-device')
  const archive = await setupDevice(wallet, 'archive-device')
  const recipient = await setupDevice(wallet, 'recipient-device')
  const senderPeer = createPeer('sender-peernet-id')
  const archivePeer = createPeer('archive-peernet-id')
  const recipientPeer = createPeer('recipient-peernet-id')
  const senderTransport = createChatTransport({
    peernet: senderPeer,
    network,
    storage: new MemoryStorage(),
    identityProvider: async () => sender
  })
  const archiveStorage = new MemoryStorage()
  const archiveTransport = createChatTransport({
    peernet: archivePeer,
    network,
    storage: archiveStorage,
    identityProvider: async () => archive
  })
  const recipientTransport = createChatTransport({
    peernet: recipientPeer,
    network,
    storage: new MemoryStorage(),
    identityProvider: async () => recipient
  })
  t.after(() => {
    senderTransport.stop()
    archiveTransport.stop()
    recipientTransport.stop()
  })

  const received = []
  recipientTransport.subscribe((event) => received.push(event))
  await Promise.all([senderTransport.start(), archiveTransport.start(), recipientTransport.start()])
  await archiveTransport.setArchiveEnabled(true)
  connectPeers(senderPeer, archivePeer)
  const envelope = await sealDirectMessage({
    id: 'offline-message',
    text: 'Store this until I return',
    sender: { account: sender.account, deviceId: sender.certificate.deviceId },
    senderCertificate: sender.certificate,
    senderSigningKey: sender.keys.signing.privateKey,
    recipient: { account: recipient.account, deviceId: recipient.certificate.deviceId, network },
    recipientCertificate: recipient.certificate,
    recipientEncryptionKey: recipient.keys.encryption.publicKey
  })

  await senderTransport.sendDirect(envelope)
  await waitForNetwork()
  assert.equal(archiveTransport.archiveCount, 1)
  assert.equal(recipientTransport.pendingCount, 0)
  assert.equal(received.length, 0)

  connectPeers(archivePeer, recipientPeer)
  assert.equal(await recipientTransport.requestInbox(), true)
  for (let attempt = 0; attempt < 20 && !received.length; attempt += 1) await waitForNetwork()
  assert.equal(received.filter(({ type }) => type === 'direct').length, 1)

  const receipt = await createDeliveryReceipt({
    messageId: envelope.id,
    recipientCertificate: recipient.certificate,
    signingKey: recipient.keys.signing.privateKey
  })
  await recipientTransport.acknowledgeDelivery(receipt)
  await waitForNetwork()
  assert.equal(archiveTransport.archiveCount, 0)
  assert.equal(senderTransport.pendingCount, 0)
  assert.equal(
    JSON.parse(archiveStorage.getItem(`${network}:leofcoin-chat-transport:v1`)).receipts[envelope.id].messageId,
    envelope.id
  )
})
