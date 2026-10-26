import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import {
  addChatFriend,
  listChatFriends,
  listChatMessages,
  loadOrCreateChatDevice,
  listChatSpaces,
  listKnownChatDevices,
  listTrustedChatDevices,
  rememberChatDevice,
  saveChatDeviceCertificate,
  saveChatMessage,
  saveChatSpace,
  trustChatDevice
} from '../controllers/chat-device-store.js'
import { createChatTransport } from '../controllers/chat-transport.js'
import {
  createDeliveryReceipt,
  createSpaceKey,
  openDirectMessage,
  openSpaceMessage,
  sealDirectMessage,
  sealSpaceMessage
} from '../controllers/chat-security.js'
import { errorMessage } from '../controllers/transfer.js'
import { getSelectedNetwork } from '../network-selection.js'

interface ChatWallet {
  selectedAccount?: string
}

interface ChatSpace {
  spaceId: string
  name: string
  ownerAccount: string
  keyBytes: Uint8Array
}

interface ChatCertificate {
  account: string
  network: string
  deviceId: string
  peerId?: string
  encryptionKey: string
  signingKey: string
  [key: string]: unknown
}

interface ChatDevice {
  account: string
  network: string
  peerId: string
  deviceId: string
  certificate: ChatCertificate
  keys: {
    encryption: { privateKey: CryptoKey; publicKey: Uint8Array }
    signing: { privateKey: CryptoKey; publicKey: Uint8Array }
  }
}

interface ChatMessage {
  id: string
  sender: string
  conversationId?: string
  conversationAccount?: string
  spaceId?: string
  text: string
  timestamp: number
  outgoing: boolean
  deliveryState?: 'queued' | 'delivered'
}

interface ChatTransportEvent {
  type: string
  certificate?: ChatCertificate
  newCertificate?: ChatCertificate
  approval?: object
  existingCertificate?: ChatCertificate
  envelope?: Record<string, any>
}

declare global {
  var identityController: {
    signer(address: string): Promise<{ sign(hash: Uint8Array): Promise<Uint8Array> }>
  }
  var peernet: {
    id?: string
    publish(topic: string, payload: Uint8Array): Promise<unknown>
    subscribe(topic: string, handler: (payload: Uint8Array) => void): Promise<unknown>
  }
  var pubsub: {
    subscribe(topic: string, handler: () => void): void
    unsubscribe(topic: string, handler: () => void): void
  }
}

@customElement('chat-view')
export class ChatView extends LitElement {
  @property({ type: Object }) accessor wallet: ChatWallet | undefined
  @property({ type: Boolean }) accessor isDesktop = false
  @state() accessor status = 'Connect to the node to start chatting.'
  @state() accessor error = ''
  @state() accessor messages: ChatMessage[] = []
  @state() accessor devices: ChatCertificate[] = []
  @state() accessor friends: string[] = []
  @state() accessor spaces: ChatSpace[] = []
  @state() accessor selectedSpaceId = ''
  @state() accessor selectedFriendPeerId = ''
  @state() accessor channel: 'direct' | 'space' = 'direct'
  @state() accessor selectedDeviceId = ''
  @state() accessor draft = ''
  @state() accessor spaceNameDraft = ''
  @state() accessor friendAddressDraft = ''
  @state() accessor addingFriend = false
  @state() accessor archiveEnabled = false
  @state() accessor pendingCount = 0
  @state() accessor archiveCount = 0
  @state() accessor device: ChatDevice | undefined

  #transport
  #unsubscribe
  #starting = false
  #requestedWallet = ''
  #connected = false

  connectedCallback() {
    super.connectedCallback()
    this.#connected = true
    globalThis.pubsub?.subscribe('node:ready', this.#onNodeReady)
    void this.#initialize()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.#connected = false
    globalThis.pubsub?.unsubscribe('node:ready', this.#onNodeReady)
    this.#unsubscribe?.()
    this.#transport?.stop()
    this.#transport = undefined
    this.#requestedWallet = ''
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('wallet')) void this.#initialize()
    if (changed.has('messages')) {
      const messages = this.renderRoot.querySelector<HTMLElement>('.messages')
      if (messages && messages.scrollHeight - messages.scrollTop - messages.clientHeight < 160)
        messages.scrollTop = messages.scrollHeight
    }
  }

  #onNodeReady = () => {
    void this.#initialize()
  }

  async #initialize() {
    const account = this.wallet?.selectedAccount
    if (!this.#connected || !account || !globalThis.peernet) {
      if (!globalThis.peernet) this.status = 'Waiting for the Peernet node…'
      else if (!account) this.status = 'Unlock a wallet to use chat.'
      return
    }
    const network = getSelectedNetwork().network
    const identityKey = `${network}:${account}`
    if (this.#requestedWallet === identityKey || this.#starting) return
    if (this.#requestedWallet && this.#requestedWallet !== identityKey) {
      this.#unsubscribe?.()
      this.#transport?.stop()
      this.#unsubscribe = undefined
      this.#transport = undefined
      this.device = undefined
      this.messages = []
      this.devices = []
      this.friends = []
      this.spaces = []
      this.selectedDeviceId = ''
      this.selectedFriendPeerId = ''
    }
    this.#starting = true
    this.#requestedWallet = identityKey
    this.error = ''
    try {
      const signer = await globalThis.identityController.signer(account)
      const device = await loadOrCreateChatDevice({
        account,
        network,
        peerId: globalThis.peernet.id || account,
        signWithAccount: signer.sign
      })
      if (!this.#connected) return
      this.device = device
      try {
        this.messages = await listChatMessages(device)
      } catch (error) {
        this.messages = []
        this.error = `Chat history could not be opened: ${errorMessage(error)}`
      }
      trustChatDevice(device.certificate)
      this.devices = listKnownChatDevices(network)
      this.friends = listChatFriends(network, account)
      this.spaces = await listChatSpaces(account, network, device)
      this.#transport = createChatTransport({
        peernet: globalThis.peernet,
        network,
        identityProvider: async () => ({
          account: this.device?.account,
          peerId: this.device?.peerId,
          deviceId: this.device?.deviceId,
          certificate: this.device?.certificate,
          signingKey: this.device?.keys.signing.privateKey
        })
      })
      this.#unsubscribe = this.#transport.subscribe((event: ChatTransportEvent) => this.#handleTransportEvent(event))
      await this.#transport.start()
      this.archiveEnabled = this.#transport.archiveEnabled
      this.pendingCount = this.#transport.pendingCount
      this.archiveCount = this.#transport.archiveCount
      this.status = `Connected as ${account.slice(0, 8)}…`
    } catch (error) {
      this.#requestedWallet = ''
      this.error = errorMessage(error)
      this.status = 'Chat could not connect.'
    } finally {
      this.#starting = false
    }
  }

  async #handleTransportEvent(event: ChatTransportEvent) {
    const network = getSelectedNetwork().network
    if (event.type === 'delivered') {
      this.pendingCount = this.#transport?.pendingCount ?? this.pendingCount
      this.archiveCount = this.#transport?.archiveCount ?? this.archiveCount
      const message = this.messages.find((item) => item.id === event.messageId)
      if (message) {
        await this.#saveMessage({ ...message, deliveryState: 'delivered' })
      }
      this.status = 'Message delivery confirmed.'
      return
    }
    if (event.type === 'device' && event.certificate) {
      rememberChatDevice(event.certificate)
      this.devices = listKnownChatDevices(network)
      if (this.selectedFriendPeerId === (event.certificate.peerId || event.certificate.account))
        this.selectedDeviceId = event.certificate.deviceId
      return
    }
    if (
      event.type === 'device-approval' &&
      event.newCertificate &&
      event.approval &&
      this.device &&
      event.newCertificate.account === this.device.account
    ) {
      const approvedCertificate = { ...event.newCertificate, approval: event.approval }
      trustChatDevice(approvedCertificate)
      rememberChatDevice(approvedCertificate)
      this.devices = listKnownChatDevices(network)
      if (approvedCertificate.deviceId === this.device.deviceId) {
        await saveChatDeviceCertificate(approvedCertificate)
        this.device = { ...this.device, certificate: approvedCertificate }
      }
      this.status = 'A new trusted device was approved.'
      return
    }
    if (event.type === 'space' && event.envelope && this.device) {
      const envelope = event.envelope
      const space = this.spaces.find((candidate) => candidate.spaceId === envelope.spaceId)
      if (!space) return
      try {
        const trustedSenders =
          envelope.senderAccount === this.device.account
            ? listTrustedChatDevices(globalThis.localStorage, network, this.device.account)
            : [envelope.senderCertificate]
        const opened = await openSpaceMessage({
          envelope,
          spaceId: space.spaceId,
          spaceKey: space.keyBytes,
          network,
          trustedCertificates: trustedSenders
        })
        if (!this.messages.some((message) => message.id === opened.id))
          await this.#saveMessage({
            id: opened.id,
            sender: opened.sender.address,
            spaceId: opened.spaceId,
            text: opened.text,
            timestamp: opened.timestamp,
            outgoing: false
          })
      } catch (error) {
        this.error = errorMessage(error)
      }
      return
    }
    if (event.type !== 'direct' || !event.envelope || !this.device) return

    const envelope = event.envelope
    this.archiveCount = this.#transport?.archiveCount ?? this.archiveCount
    this.pendingCount = this.#transport?.pendingCount ?? this.pendingCount
    if (
      envelope.recipientAccount !== this.device.account ||
      envelope.recipientDeviceId !== this.device.deviceId
    )
      return

    try {
      const trustedSenders =
        envelope.senderAccount === this.device.account
          ? listTrustedChatDevices(globalThis.localStorage, network, this.device.account)
          : [envelope.senderCertificate]
      const opened = await openDirectMessage({
        envelope,
        recipientAccount: this.device.account,
        recipientDeviceId: this.device.deviceId,
        recipientPrivateKey: this.device.keys.encryption.privateKey,
        network,
        trustedCertificates: trustedSenders
      })
      const invite = this.#decodeSpaceInvite(opened.text)
      if (invite) {
        if (invite.ownerAccount !== opened.sender.address)
          throw new Error('Space invitations must be sent by the Space owner.')
        const savedSpace = await saveChatSpace(
          {
            account: this.device.account,
            network,
            spaceId: invite.spaceId,
            name: invite.name,
            ownerAccount: invite.ownerAccount,
            keyBytes: invite.keyBytes
          },
          this.device
        )
        this.spaces = await listChatSpaces(this.device.account, network, this.device)
        this.selectedSpaceId = savedSpace.spaceId
        this.channel = 'space'
        this.status = `Joined ${savedSpace.name}.`
        const receipt = await createDeliveryReceipt({
          messageId: envelope.id,
          recipientCertificate: this.device.certificate,
          signingKey: this.device.keys.signing.privateKey
        })
        await this.#transport.acknowledgeDelivery(receipt)
        this.archiveCount = this.#transport.archiveCount
        this.pendingCount = this.#transport.pendingCount
        return
      }
      if (!this.messages.some((message) => message.id === opened.id)) {
        await this.#saveMessage({
          id: opened.id,
          sender: opened.sender.address,
          conversationId: envelope.senderCertificate.peerId || opened.sender.address,
          conversationAccount: opened.sender.address,
          text: opened.text,
          timestamp: opened.timestamp,
          outgoing: false
        })
      }
      const receipt = await createDeliveryReceipt({
        messageId: envelope.id,
        recipientCertificate: this.device.certificate,
        signingKey: this.device.keys.signing.privateKey
      })
      await this.#transport.acknowledgeDelivery(receipt)
      this.pendingCount = this.#transport.pendingCount
      this.archiveCount = this.#transport.archiveCount
      this.status = 'Message received and confirmed.'
      this.error = ''
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  #selectDevice = (event: Event) => {
    this.selectedDeviceId = (event.currentTarget as HTMLSelectElement).value
  }

  async #saveMessage(message: ChatMessage) {
    if (!this.device) throw new Error('Chat device is not ready to save this message.')
    await saveChatMessage(this.device, message)
    const existing = this.messages.findIndex((item) => item.id === message.id)
    const messages = [...this.messages]
    if (existing === -1) messages.push(message)
    else messages[existing] = message
    this.messages = messages.sort((left, right) => left.timestamp - right.timestamp)
  }

  #selectFriend = (peerId: string) => {
    const certificate = this.devices.find(
      (device) => (device.peerId || device.account) === peerId || device.account === peerId
    )
    this.channel = 'direct'
    this.selectedSpaceId = ''
    this.selectedFriendPeerId = peerId
    this.selectedDeviceId = certificate?.deviceId || ''
    if (!certificate) this.status = 'Friend saved. Waiting for their device to connect to Peernet.'
  }

  #addFriend = (event: SubmitEvent) => {
    event.preventDefault()
    if (!this.device) return
    try {
      this.friends = addChatFriend(
        this.device.network,
        this.device.account,
        this.friendAddressDraft,
        globalThis.localStorage,
        this.device.peerId
      )
      this.#selectFriend(this.friendAddressDraft.trim())
      this.status = this.devices.some(
        (device) =>
          (device.peerId || device.account) === this.friendAddressDraft.trim() ||
          device.account === this.friendAddressDraft.trim()
      )
        ? 'Friend added. You can start a direct message.'
        : 'Friend saved. They will appear when their device connects to Peernet.'
      this.friendAddressDraft = ''
      this.addingFriend = false
      this.error = ''
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  #copyOwnPeernetId = async () => {
    const peerId = globalThis.peernet?.id || this.device?.peerId
    if (!peerId || !globalThis.navigator?.clipboard) {
      this.error = 'Clipboard access is unavailable. Copy your Peernet ID from your wallet instead.'
      return
    }
    try {
      await globalThis.navigator.clipboard.writeText(peerId)
      this.status = 'Your Peernet ID was copied. Share it with your friend.'
      this.error = ''
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  #decodeSpaceInvite(text: string) {
    if (!text.startsWith('LFCSPACE1:')) return undefined
    try {
      const encoded = text.slice('LFCSPACE1:'.length)
      const binary = atob(encoded)
      const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))))
      if (
        payload?.version !== 1 ||
        typeof payload.spaceId !== 'string' ||
        !payload.spaceId ||
        typeof payload.name !== 'string' ||
        !payload.name ||
        payload.name.length > 80 ||
        typeof payload.ownerAccount !== 'string' ||
        typeof payload.key !== 'string'
      )
        throw new Error('Space invitation is invalid.')
      const keyBinary = atob(payload.key)
      const keyBytes = Uint8Array.from(keyBinary, (char) => char.charCodeAt(0))
      if (keyBytes.length !== 32) throw new Error('Space invitation key is invalid.')
      return {
        spaceId: payload.spaceId,
        name: payload.name,
        ownerAccount: payload.ownerAccount,
        keyBytes
      }
    } catch (error) {
      throw new Error('Space invitation could not be decoded.', { cause: error })
    }
  }

  #encodeSpaceInvite(space: ChatSpace) {
    const payload = {
      version: 1,
      spaceId: space.spaceId,
      name: space.name,
      ownerAccount: space.ownerAccount,
      key: this.#encodeBase64(space.keyBytes)
    }
    const bytes = new TextEncoder().encode(JSON.stringify(payload))
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return `LFCSPACE1:${btoa(binary)}`
  }

  #encodeBase64(value: Uint8Array) {
    let binary = ''
    for (const byte of value) binary += String.fromCharCode(byte)
    return btoa(binary)
  }

  #createSpace = async (event: SubmitEvent) => {
    event.preventDefault()
    if (!this.device || !this.spaceNameDraft.trim()) return
    try {
      const space = await saveChatSpace(
        {
          account: this.device.account,
          network: this.device.network,
          spaceId: crypto.randomUUID(),
          name: this.spaceNameDraft.trim(),
          ownerAccount: this.device.account,
          keyBytes: createSpaceKey()
        },
        this.device
      )
      this.spaces = await listChatSpaces(this.device.account, this.device.network, this.device)
      this.selectedSpaceId = space.spaceId
      this.channel = 'space'
      this.spaceNameDraft = ''
      this.status = `Created ${space.name}. Invite devices to add members.`
      this.error = ''
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  #inviteSpace = async (certificate: ChatCertificate) => {
    const space = this.spaces.find((candidate) => candidate.spaceId === this.selectedSpaceId)
    if (!space || !this.device || !this.#transport || space.ownerAccount !== this.device.account) return
    try {
      const text = this.#encodeSpaceInvite(space)
      const envelope = await sealDirectMessage({
        id: crypto.randomUUID(),
        text,
        sender: { account: this.device.account, deviceId: this.device.deviceId },
        senderCertificate: this.device.certificate,
        senderSigningKey: this.device.keys.signing.privateKey,
        recipient: {
          account: certificate.account,
          deviceId: certificate.deviceId,
          network: certificate.network
        },
        recipientCertificate: certificate,
        recipientEncryptionKey: this.#decodeBase64(certificate.encryptionKey)
      })
      await this.#transport.sendDirect(envelope)
      this.status = `Space invitation sent to ${certificate.account.slice(0, 8)}…`
      this.pendingCount = this.#transport.pendingCount
      this.error = ''
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  #send = async (event: SubmitEvent) => {
    event.preventDefault()
    if (!this.device || !this.#transport || !this.draft.trim()) return
    if (this.channel === 'space') {
      const space = this.spaces.find((candidate) => candidate.spaceId === this.selectedSpaceId)
      if (!space) {
        this.error = 'Choose a Space before sending a message.'
        return
      }
      try {
        const id = crypto.randomUUID()
        const envelope = await sealSpaceMessage({
          id,
          spaceId: space.spaceId,
          text: this.draft,
          sender: { account: this.device.account, deviceId: this.device.deviceId },
          certificate: this.device.certificate,
          signingKey: this.device.keys.signing.privateKey,
          spaceKey: space.keyBytes
        })
        await this.#saveMessage({
          id,
          sender: this.device.account,
          spaceId: space.spaceId,
          text: this.draft.trim(),
          timestamp: envelope.timestamp,
          outgoing: true
        })
        await this.#transport.sendSpace(envelope)
        this.draft = ''
        this.error = ''
      } catch (error) {
        this.error = errorMessage(error)
      }
      return
    }
    const recipientCertificate = this.devices.find((device) => device.deviceId === this.selectedDeviceId)
    if (!recipientCertificate) {
      this.error = 'Choose a discovered device before sending a message.'
      return
    }
    try {
      const id = crypto.randomUUID()
      const envelope = await sealDirectMessage({
        id,
        text: this.draft,
        sender: { account: this.device.account, deviceId: this.device.deviceId },
        senderCertificate: this.device.certificate,
        senderSigningKey: this.device.keys.signing.privateKey,
        recipient: {
          account: recipientCertificate.account,
          deviceId: recipientCertificate.deviceId,
          network: recipientCertificate.network
        },
        recipientCertificate,
        recipientEncryptionKey: this.#decodeBase64(recipientCertificate.encryptionKey)
      })
      await this.#saveMessage({
        id,
        sender: this.device.account,
        conversationId: recipientCertificate.peerId || recipientCertificate.account,
        conversationAccount: recipientCertificate.account,
        text: this.draft.trim(),
        timestamp: envelope.timestamp,
        outgoing: true,
        deliveryState: 'queued'
      })
      await this.#transport.sendDirect(envelope)
      this.draft = ''
      this.pendingCount = this.#transport.pendingCount
      this.error = ''
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  #approveDevice = async (certificate: ChatCertificate) => {
    if (!this.device || !this.#transport) return
    try {
      const approved = await this.#transport.approveDevice({
        newCertificate: certificate,
        existingCertificate: this.device.certificate,
        signingKey: this.device.keys.signing.privateKey
      })
      trustChatDevice(approved)
      rememberChatDevice(approved)
      this.devices = listKnownChatDevices(this.device.network)
      this.status = 'Device approved.'
      this.error = ''
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  #setArchiveEnabled = async (event: Event) => {
    const enabled = (event.currentTarget as HTMLInputElement).checked
    if (!this.#transport) return
    try {
      await this.#transport.setArchiveEnabled(enabled)
      this.archiveEnabled = this.#transport.archiveEnabled
      this.archiveCount = this.#transport.archiveCount
      this.error = ''
    } catch (error) {
      this.error = errorMessage(error)
    }
  }

  #decodeBase64(value: string) {
    const binary = atob(value)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
      box-sizing: border-box;
      padding: clamp(12px, 2vw, 24px);
      color: var(--md-sys-color-on-surface, #eee);
    }
    main {
      height: 100%;
      max-width: 1120px;
      margin: auto;
      display: grid;
      grid-template-columns: minmax(220px, 290px) minmax(0, 1fr);
      gap: 16px;
    }
    aside, .conversation {
      min-height: 0;
      border: 1px solid var(--lfc-glass-border, #51474e);
      border-radius: 22px;
      background: var(--lfc-glass-surface, #242126);
      overflow: hidden;
    }
    aside { display: flex; flex-direction: column; }
    .conversation { display: flex; flex-direction: column; }
    header { padding: 22px; border-bottom: 1px solid var(--lfc-glass-border, #51474e); }
    h1, h2, p { margin: 0; }
    h1 { font-size: 25px; letter-spacing: -.03em; }
    h2 { font-size: 16px; }
    .eyebrow { color: var(--md-sys-color-primary, #8dbbff); font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
    .muted, .status { color: var(--md-sys-color-on-surface-variant, #c8c2cc); font-size: 13px; }
    .device-list { padding: 12px; display: grid; gap: 8px; overflow: auto; }
    .device, .archive-card { padding: 14px; border-radius: 14px; background: color-mix(in srgb, var(--md-sys-color-surface, #242126) 76%, transparent); }
    .device { display: grid; gap: 8px; }
    .space-list { display: grid; gap: 8px; padding: 12px; border-top: 1px solid var(--lfc-glass-border, #51474e); }
    .space-list button { width: 100%; text-align: left; background: transparent; color: inherit; }
    .space-list button[aria-current="true"] { border-color: var(--md-sys-color-primary, #8dbbff); background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 14%, transparent); }
    .create-space { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
    .create-space input, .create-space button { min-width: 0; padding: 7px; font-size: 12px; }
    .device-id { overflow-wrap: anywhere; font-size: 12px; }
    .empty { padding: 18px; text-align: center; }
    .layout { height: 100%; max-width: 1240px; margin: auto; display: grid; grid-template-columns: 68px minmax(230px, 280px) minmax(0, 1fr); gap: 10px; }
    .server-rail { display: flex; align-items: center; flex-direction: column; gap: 10px; padding: 12px 8px; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 22px; background: color-mix(in srgb, var(--lfc-glass-surface, #242126) 90%, transparent); }
    .rail-spacer { flex: 0 0 1px; width: 28px; margin: 4px 0; background: var(--lfc-glass-border, #51474e); }
    .rail-button { display: grid; place-items: center; width: 46px; height: 46px; min-height: 46px; padding: 0; border: 0; border-radius: 17px; background: color-mix(in srgb, var(--md-sys-color-surface, #242126) 82%, transparent); color: var(--md-sys-color-on-surface-variant, #c8c2cc); font-size: 20px; transition: border-radius .16s ease, background .16s ease; }
    .rail-button:hover, .rail-button[aria-current="true"] { border-radius: 14px; background: var(--md-sys-color-primary, #3477d2); color: var(--md-sys-color-on-primary, #fff); }
    .rail-button.add { border: 1px dashed var(--lfc-glass-border, #51474e); background: transparent; color: var(--md-sys-color-primary, #8dbbff); }
    .sidebar { display: flex; min-height: 0; flex-direction: column; border: 1px solid var(--lfc-glass-border, #51474e); border-radius: 22px; background: var(--lfc-glass-surface, #242126); overflow: hidden; }
    .sidebar-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 16px; }
    .sidebar-header h1 { font-size: 19px; }
    .sidebar-header .status { margin-top: 4px; font-size: 11px; }
    .sidebar-header .add-friend { flex: 0 0 38px; width: 38px; min-height: 38px; padding: 0; border-radius: 13px; font-size: 20px; }
    .friend-form { display: grid; gap: 8px; padding: 0 12px 12px; }
    .friend-form button { width: 100%; }
    .friend-form .copy-id { border-color: var(--lfc-glass-border, #51474e); background: transparent; color: var(--md-sys-color-primary, #8dbbff); }
    .friend-form .muted { font-size: 11px; line-height: 1.45; }
    .sidebar-section { display: grid; gap: 6px; padding: 14px 12px; border-top: 1px solid var(--lfc-glass-border, #51474e); }
    .section-title { display: flex; align-items: center; justify-content: space-between; padding: 0 3px 4px; color: var(--md-sys-color-on-surface-variant, #c8c2cc); font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
    .section-title button { width: 28px; min-height: 28px; padding: 0; border: 0; background: transparent; color: inherit; font-size: 18px; }
    .friend-item, .space-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 7px 10px; border: 0; border-radius: 13px; background: transparent; color: var(--md-sys-color-on-surface-variant, #c8c2cc); text-align: left; font-weight: 550; }
    .friend-item:hover, .space-item:hover, .friend-item[aria-current="true"], .space-item[aria-current="true"] { background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 13%, transparent); color: var(--md-sys-color-on-surface, #eee); }
    .friend-avatar, .space-avatar { display: grid; flex: 0 0 30px; width: 30px; height: 30px; place-items: center; border-radius: 11px; background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 15%, transparent); color: var(--md-sys-color-primary, #8dbbff); font-size: 12px; font-weight: 750; }
    .friend-copy { display: grid; min-width: 0; gap: 2px; }
    .friend-copy strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; }
    .friend-copy small { color: var(--md-sys-color-on-surface-variant, #c8c2cc); font-size: 10px; }
    .empty-list { display: grid; justify-items: center; gap: 7px; padding: 12px 5px; color: var(--md-sys-color-on-surface-variant, #c8c2cc); font-size: 11px; text-align: center; }
    .empty-list strong { color: var(--md-sys-color-on-surface, #eee); font-size: 12px; }
    .empty-icon { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 12px; background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 15%, transparent); color: var(--md-sys-color-primary, #8dbbff); font-size: 18px; }
    .sidebar-spacer { flex: 1; min-height: 8px; }
    .sidebar .archive-card { margin: 8px; }
    .settings-section { padding-top: 8px; padding-bottom: 8px; }
    .settings-section > summary { cursor: pointer; list-style: none; }
    .settings-section > summary::-webkit-details-marker { display: none; }
    .settings-section > summary::after { content: '+'; font-size: 16px; }
    .settings-section[open] > summary::after { content: '−'; }
    .archive-card { margin: auto 12px 12px; display: grid; gap: 8px; font-size: 13px; }
    .archive-setting { display: flex; gap: 8px; align-items: flex-start; }
    .messages { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 12px; padding: 20px; overflow: auto; }
    .message { max-width: min(78%, 620px); align-self: flex-start; padding: 12px 14px; border-radius: 16px 16px 16px 4px; background: color-mix(in srgb, var(--md-sys-color-surface, #242126) 74%, transparent); overflow-wrap: anywhere; }
    .message.outgoing { align-self: flex-end; border-radius: 16px 16px 4px 16px; background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 16%, var(--md-sys-color-surface, #242126)); }
    .message { white-space: pre-wrap; }
    .message-meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 4px; font-size: 11px; color: var(--md-sys-color-on-surface-variant, #c8c2cc); }
    .message-meta time, .message-state { font-size: 10px; color: var(--md-sys-color-on-surface-variant, #c8c2cc); }
    form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 14px; border-top: 1px solid var(--lfc-glass-border, #51474e); }
    input, select, button { min-height: 42px; box-sizing: border-box; border-radius: 12px; border: 1px solid var(--lfc-glass-border, #51474e); background: var(--md-sys-color-surface, #242126); color: inherit; font: inherit; padding: 9px 12px; }
    button { cursor: pointer; background: var(--md-sys-color-primary, #3477d2); color: var(--md-sys-color-on-primary, #fff); font-weight: 650; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    .compose { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
    .notice { margin: 12px 18px 0; }
    .error { color: var(--md-sys-color-error, #ffb4ab); }
    .spaces-note { padding: 15px; border-top: 1px solid var(--lfc-glass-border, #51474e); font-size: 13px; }
    @media (max-width: 700px) {
      :host { padding: 8px; }
      .layout { grid-template-columns: 54px minmax(150px, 38%) minmax(0, 1fr); gap: 6px; }
      .server-rail { padding: 8px 4px; border-radius: 16px; }
      .rail-button { width: 40px; height: 40px; min-height: 40px; }
      .sidebar { border-radius: 16px; }
      .sidebar-header { padding: 12px 10px; }
      .sidebar-header h1 { font-size: 15px; }
      .sidebar-header .status { display: none; }
      .sidebar-header .add-friend { flex-basis: 32px; width: 32px; min-height: 32px; }
      .sidebar-section { padding: 10px 7px; }
      .friend-item, .space-item { gap: 6px; padding: 6px; }
      .friend-avatar, .space-avatar { flex-basis: 26px; width: 26px; height: 26px; }
      .friend-copy strong { font-size: 10px; }
      .friend-copy small { font-size: 9px; }
      .device-list { padding: 8px; }
      .sidebar .archive-card { margin: 6px; padding: 9px; }
      .conversation { border-radius: 16px; }
      .conversation > header { padding: 14px; }
      .messages { padding: 12px; }
      form { gap: 6px; padding: 8px; }
      .message { max-width: 88%; }
    }
  `

  render() {
    const selectedCertificate = this.devices.find((device) => device.deviceId === this.selectedDeviceId)
    const conversationAccount = selectedCertificate?.account || this.selectedFriendPeerId
    const selectedSpace = this.spaces.find((space) => space.spaceId === this.selectedSpaceId)
    const conversationMessages = this.messages.filter(
      (message) =>
        this.channel === 'space'
          ? message.spaceId === this.selectedSpaceId
          : message.conversationId === this.selectedFriendPeerId ||
            message.conversationAccount === conversationAccount
    )
    const ownPendingDevices = this.devices.filter(
      (certificate) =>
        certificate.account === this.device?.account &&
        certificate.deviceId !== this.device?.deviceId
    )
    const recipientDevices = this.devices.filter(
      (certificate) =>
        certificate.account !== this.device?.account &&
        ((certificate.peerId || certificate.account) === this.selectedFriendPeerId ||
          certificate.account === this.selectedFriendPeerId)
    )
    return html`
      <main class="layout">
        <nav class="server-rail" aria-label="Chat navigation">
          <button
            class="rail-button"
            type="button"
            aria-label="Direct messages"
            title="Direct messages"
            aria-current=${this.channel === 'direct' ? 'true' : 'false'}
            @click=${() => {
              this.channel = 'direct'
              this.selectedSpaceId = ''
            }}
          >✉</button>
          <span class="rail-spacer" aria-hidden="true"></span>
          ${this.spaces.map(
            (space) => html`
              <button
                class="rail-button"
                type="button"
                aria-label=${space.name}
                title=${space.name}
                aria-current=${this.channel === 'space' && this.selectedSpaceId === space.spaceId ? 'true' : 'false'}
                @click=${() => {
                  this.selectedSpaceId = space.spaceId
                  this.channel = 'space'
                }}
              >${Array.from(space.name)[0]?.toUpperCase() || '#'}</button>
            `
          )}
          <button
            class="rail-button add"
            type="button"
            aria-label="Create Space"
            title="Create Space"
            @click=${() => this.renderRoot.querySelector<HTMLInputElement>('.create-space input')?.focus()}
          >+</button>
        </nav>
        <aside class="sidebar">
          <header class="sidebar-header">
            <div>
              <p class="eyebrow">Peernet</p>
              <h1>${this.channel === 'space' ? selectedSpace?.name || 'Spaces' : 'Messages'}</h1>
              <p class="status">${this.status}</p>
            </div>
            <button
              class="add-friend"
              type="button"
              aria-label=${this.addingFriend ? 'Cancel adding friend' : 'Add friend'}
              title="Add friend"
              @click=${() => (this.addingFriend = !this.addingFriend)}
            >${this.addingFriend ? '×' : '+'}</button>
          </header>
          ${this.addingFriend
            ? html`<form class="friend-form" @submit=${this.#addFriend}>
                <input
                  .value=${this.friendAddressDraft}
                  @input=${(event: Event) =>
                    (this.friendAddressDraft = (event.currentTarget as HTMLInputElement).value)}
                  maxlength="128"
                  autocomplete="off"
                  placeholder="Friend's Peernet ID"
                  aria-label="Friend's Peernet ID"
                  required
                />
                <p class="muted">Ask them to share their Peernet ID. They must be online on the same network for their device to appear.</p>
                <button type="submit">Add friend</button>
                <button class="copy-id" type="button" @click=${this.#copyOwnPeernetId}>Copy my Peernet ID</button>
              </form>`
            : ''}
          <section class="sidebar-section">
            <div class="section-title"><span>Direct messages</span></div>
            ${this.friends.length
              ? this.friends.map((friend) => {
                  const certificate = this.devices.find(
                    (device) => (device.peerId || device.account) === friend || device.account === friend
                  )
                  return html`<button
                    class="friend-item"
                    type="button"
                    aria-current=${this.channel === 'direct' && this.selectedFriendPeerId === friend ? 'true' : 'false'}
                    @click=${() => this.#selectFriend(friend)}
                  >
                    <span class="friend-avatar" aria-hidden="true">${friend.slice(0, 1).toUpperCase()}</span>
                    <span class="friend-copy">
                      <strong>${friend.slice(0, 12)}…</strong>
                      <small>${certificate ? 'Known device' : 'Waiting for device'}</small>
                    </span>
                  </button>`
                })
              : html`<div class="empty-list">
                  <span class="empty-icon" aria-hidden="true">✉</span>
                  <strong>No conversations yet</strong>
                  <span>Use + to add a friend by Peernet ID.</span>
                </div>`}
          </section>
          <section class="sidebar-section">
            <div class="section-title">
              <span>Joined Spaces</span>
              <button
                type="button"
                aria-label="Create Space"
                title="Create Space"
                @click=${() => this.renderRoot.querySelector<HTMLInputElement>('.create-space input')?.focus()}
              >+</button>
            </div>
            ${this.spaces.map(
              (space) => html`<button
                class="space-item"
                type="button"
                aria-current=${this.channel === 'space' && this.selectedSpaceId === space.spaceId ? 'true' : 'false'}
                @click=${() => {
                  this.selectedSpaceId = space.spaceId
                  this.channel = 'space'
                }}
              >
                <span class="space-avatar" aria-hidden="true">#</span>
                <span>${space.name}</span>
              </button>`
            )}
            ${this.spaces.length ? '' : html`<p class="muted">Spaces you join will show up here.</p>`}
            <form class="create-space" @submit=${this.#createSpace}>
              <input
                .value=${this.spaceNameDraft}
                @input=${(event: Event) =>
                  (this.spaceNameDraft = (event.currentTarget as HTMLInputElement).value)}
                maxlength="80"
                placeholder="New Space name"
                aria-label="New Space name"
              />
              <button type="submit" ?disabled=${!this.spaceNameDraft.trim()}>Create</button>
            </form>
          </section>
          <div class="sidebar-spacer"></div>
          <details class="sidebar-section settings-section">
            <summary class="section-title">Device settings (${this.devices.length})</summary>
            <div class="device-list">
              ${this.devices.length
                ? this.devices.map(
                  (certificate) => html`
                    <article class="device">
                      <span>${certificate.account.slice(0, 12)}…</span>
                      <span class="device-id">${certificate.deviceId}</span>
                      ${certificate.account === this.device?.account &&
                      certificate.deviceId !== this.device?.deviceId
                        ? html`<button type="button" @click=${() => this.#approveDevice(certificate)}>
                            Approve device
                          </button>`
                        : ''}
                      ${this.channel === 'space' &&
                      selectedSpace?.ownerAccount === this.device?.account &&
                      certificate.account !== this.device?.account
                        ? html`<button type="button" @click=${() => this.#inviteSpace(certificate)}>
                            Invite to ${selectedSpace.name}
                          </button>`
                        : ''}
                    </article>
                  `
                )
                : html`<p class="muted empty">No devices discovered yet. Use the same network and keep Chat open to be discovered.</p>`}
            </div>
          </details>
          <details class="sidebar-section settings-section">
            <summary class="section-title">Offline delivery</summary>
            <section class="archive-card">
              <label class="archive-setting">
                <input
                  type="checkbox"
                  .checked=${this.archiveEnabled}
                  @change=${this.#setArchiveEnabled}
                />
                <span><strong>Offer encrypted DM archiving</strong><br />Store ciphertext temporarily for offline devices.</span>
              </label>
              <p class="muted">${this.archiveCount} archived · ${this.pendingCount} pending delivery</p>
              <p class="muted">Archiving is opt-in. Copies are removed after a verified receipt when reachable.</p>
            </section>
          </details>
        </aside>
        <section class="conversation">
          <header>
            <p class="eyebrow">${this.channel === 'space' ? 'Space' : 'Direct message'}</p>
            <h2>${this.channel === 'space'
              ? selectedSpace?.name || 'Choose a Space'
              : this.selectedFriendPeerId || 'Choose a friend'}</h2>
            <p class="muted">
              ${this.channel === 'space'
                ? 'End-to-end encrypted for members who received the Space invitation.'
                : 'End-to-end encrypted between approved device keys.'}
            </p>
          </header>
          ${this.error ? html`<p class="notice error" role="alert">${this.error}</p>` : ''}
          ${this.channel === 'direct' && conversationAccount && !selectedCertificate
            ? html`<p class="notice muted">This friend is offline. Messages can be sent when one of their devices announces on this network.</p>`
            : ''}
          ${ownPendingDevices.length
            ? html`<p class="notice muted">Approve only devices you recognize and control.</p>`
            : ''}
          <div class="messages" aria-live="polite">
            ${conversationMessages.length
              ? conversationMessages.map(
                  (message) => html`
                    <article class=${message.outgoing ? 'message outgoing' : 'message'}>
                      <span class="message-meta">
                        <span>${message.outgoing ? 'You' : message.sender}</span>
                        <time datetime=${new Date(message.timestamp).toISOString()}>
                          ${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </span>
                      <span>${message.text}</span>
                      ${message.deliveryState
                        ? html`<small class="message-state">
                            ${message.deliveryState === 'delivered'
                                ? 'Delivered'
                                : 'Waiting for delivery'}
                          </small>`
                        : ''}
                    </article>
                  `
                )
              : html`<p class="muted empty">
                  ${this.channel === 'space'
                    ? 'No messages in this Space yet. Send one while the other members are online.'
                    : this.selectedFriendPeerId
                      ? 'No messages yet. Say hello.'
                      : this.friends.length
                        ? 'Choose a friend to view your conversation.'
                        : 'Add a friend with their Peernet ID to start a conversation.'}
                </p>`}
          </div>
          <form @submit=${this.#send}>
            ${this.channel === 'direct'
              ? html`<select .value=${this.selectedDeviceId} @change=${this.#selectDevice} aria-label="Recipient device">
                  <option value="">Choose recipient device</option>
                  ${recipientDevices.map(
                      (certificate) =>
                        html`<option value=${certificate.deviceId}>
                          ${certificate.account.slice(0, 12)}… · ${certificate.deviceId.slice(0, 8)}
                        </option>`
                    )}
                </select>`
              : html`<span class="muted"># ${selectedSpace?.name || 'Select a Space'}</span>`}
            <div class="compose">
              <input
                .value=${this.draft}
                @input=${(event: Event) => (this.draft = (event.currentTarget as HTMLInputElement).value)}
                maxlength="4000"
                placeholder="Write a message…"
                aria-label="Message"
              />
              <button
                type="submit"
                ?disabled=${(this.channel === 'direct' && !this.selectedDeviceId) ||
                (this.channel === 'space' && !this.selectedSpaceId) ||
                !this.draft.trim()}
              >
                Send
              </button>
            </div>
          </form>
        </section>
      </main>
    `
  }
}
