import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import * as qrcode from 'qrcode'
import {
  addChatFriend,
  listChatFriends,
  listChatMessages,
  managedSpacesStorageKey,
  loadOrCreateChatDevice,
  listChatSpaces,
  listKnownChatDevices,
  listTrustedChatDevices,
  rememberChatDevice,
  saveChatDeviceCertificate,
  saveChatMessage,
  trustChatDevice
} from '../controllers/chat-device-store.js'
import { createChatTransport } from '../controllers/chat-transport.js'
import {
  createDeliveryReceipt,
  openDirectMessage,
  openSpaceMessage,
  sealDirectMessage,
  sealSpaceMessage
} from '../controllers/chat-security.js'
import { errorMessage } from '../controllers/transfer.js'
import { getSelectedNetwork } from '../network-selection.js'
import { ChatSpaces, canSendToSpace, canReceiveSpaceMessage, parseSpaceInvitation, spaceInvitationLink, spaceChannels, spaceRole } from '../controllers/chat-spaces.js'

interface ChatWallet {
  selectedAccount?: string
}

interface ChatSpace {
  spaceId: string
  name: string
  ownerAccount: string
  keyBytes: Uint8Array
  status?: string
  manifest?: any
  invites?: any[]
  requests?: any[]
  invitation?: any
  channelRequests?: any[]
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
  channelId?: string
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
  @state() accessor selectedChannelId = 'general'
  @state() accessor selectedFriendPeerId = ''
  @state() accessor channel: 'direct' | 'space' = 'direct'
  @state() accessor selectedDeviceId = ''
  @state() accessor draft = ''
  @state() accessor spaceNameDraft = ''
  @state() accessor friendAddressDraft = ''
  @state() accessor archiveEnabled = false
  @state() accessor pendingCount = 0
  @state() accessor archiveCount = 0
  @state() accessor device: ChatDevice | undefined
  @state() accessor search = ''
  @state() accessor mobileConversation = false
  @state() accessor sending = false
  @state() accessor connected = false
  @state() accessor panel: 'friend' | 'space' | 'settings' | 'join' | 'manage' | '' = ''
  @state() accessor inviteInput = ''
  @state() accessor invitePreview: any = undefined
  @state() accessor generatedInvite = ''
  @state() accessor inviteQr = ''
  @state() accessor busy = false
  @state() accessor managerQueue = 0
  @state() accessor confirmRemoval = ''
  @state() accessor channelEditingId = ''
  @state() accessor channelEditingVersion = ''
  @state() accessor channelNameDraft = ''
  @state() accessor channelTopicDraft = ''

  #transport
  #spaces: ChatSpaces | undefined
  #legacySpaces: ChatSpace[] = []
  #spaceRetry: ReturnType<typeof setInterval> | undefined
  #unsubscribe
  #starting = false
  #requestedWallet = ''
  #connected = false
  #stickToBottom = true
  #drafts = new Map<string, string>()

  #conversationKey() {
    return this.channel === 'space' ? `space:${this.selectedSpaceId}:${this.selectedChannelId}` : `direct:${this.selectedFriendPeerId}`
  }

  #rememberDraft() {
    this.#drafts.set(this.#conversationKey(), this.draft)
  }

  #restoreDraft() {
    this.draft = this.#drafts.get(this.#conversationKey()) || ''
    const input = this.renderRoot.querySelector<HTMLTextAreaElement>('.composer textarea')
    if (input) input.style.height = 'auto'
  }

  #scrollToBottom = () => {
    const list = this.renderRoot.querySelector<HTMLElement>('.messages')
    if (list) list.scrollTop = list.scrollHeight
    this.#stickToBottom = true
  }

  #openPanel = async (panel: 'friend' | 'space' | 'settings' | 'join' | 'manage') => {
    this.panel = panel
    await this.updateComplete
    this.renderRoot.querySelector<HTMLDialogElement>('dialog')?.showModal()
  }

  #closePanel = () => {
    this.renderRoot.querySelector<HTMLDialogElement>('dialog')?.close()
    this.panel = ''
  }

  #selectSpace = (spaceId: string) => {
    this.confirmRemoval = ''
    this.#rememberDraft()
    if (spaceId !== this.selectedSpaceId) {
      this.generatedInvite = ''; this.inviteQr = ''; this.selectedChannelId = 'general'; this.#resetChannelForm()
    }
    this.channel = 'space'
    this.selectedSpaceId = spaceId
    this.#restoreDraft()
    this.mobileConversation = true
    this.#stickToBottom = true
  }

  #selectSpaceChannel = (spaceId: string, channelId: string) => {
    this.#selectSpace(spaceId)
    this.#rememberDraft()
    this.selectedChannelId = channelId
    this.#restoreDraft()
    this.#scrollToBottom()
  }

  #resetChannelForm = () => {
    this.channelEditingId = ''; this.channelEditingVersion = ''; this.channelNameDraft = ''; this.channelTopicDraft = ''
  }

  #editChannel = (channel: any) => {
    this.channelEditingId = channel.id; this.channelEditingVersion = channel.version
    this.channelNameDraft = channel.name; this.channelTopicDraft = channel.topic
  }

  #changeChannel = async (operation: any) => {
    if (!this.#spaces) return
    const space = this.spaces.find(item => item.spaceId === this.selectedSpaceId)
    const owner = spaceRole(space, this.device?.certificate) === 'owner'
    await this.#spaceAction(async () => {
      const result = await this.#spaces!.changeChannel(this.selectedSpaceId, operation)
      if (owner && operation.action === 'create') this.#selectSpaceChannel(this.selectedSpaceId, result.channelId)
      this.#resetChannelForm()
    }, owner ? 'Channel updated.' : 'Channel change queued. The owner device must open Chat to authorize it.')
  }

  #saveChannel = async (event: SubmitEvent) => {
    event.preventDefault()
    await this.#changeChannel({action:this.channelEditingId ? 'edit' : 'create',
      ...(this.channelEditingId ? {channelId:this.channelEditingId,expectedVersion:this.channelEditingVersion} : {}),
      name:this.channelNameDraft,topic:this.channelTopicDraft})
  }

  #composerInput = (event: Event) => {
    const input = event.currentTarget as HTMLTextAreaElement
    this.draft = input.value
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`
  }

  #composerKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
    event.preventDefault()
    ;(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit()
  }

  connectedCallback() {
    super.connectedCallback()
    this.#connected = true
    globalThis.pubsub?.subscribe('node:ready', this.#onNodeReady)
    globalThis.addEventListener('storage', this.#onSpaceStorage)
    void this.#initialize()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.#connected = false
    this.connected = false
    clearInterval(this.#spaceRetry)
    globalThis.pubsub?.unsubscribe('node:ready', this.#onNodeReady)
    globalThis.removeEventListener('storage', this.#onSpaceStorage)
    this.#unsubscribe?.()
    this.#transport?.stop()
    this.#transport = undefined
    this.#spaces = undefined
    this.#requestedWallet = ''
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('wallet')) void this.#initialize()
    if ((changed.has('messages') && this.#stickToBottom) || changed.has('selectedSpaceId') || changed.has('selectedChannelId') || changed.has('selectedFriendPeerId') || changed.has('channel'))
      this.#scrollToBottom()
    if (changed.has('draft') && !this.draft) {
      const input = this.renderRoot.querySelector<HTMLTextAreaElement>('.composer textarea')
      if (input) input.style.height = 'auto'
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
      this.#spaces = undefined
      this.#legacySpaces = []
      clearInterval(this.#spaceRetry)
      this.connected = false
      this.device = undefined
      this.messages = []
      this.devices = []
      this.friends = []
      this.spaces = []
      this.selectedDeviceId = ''
      this.selectedFriendPeerId = ''
      this.selectedSpaceId = ''
      this.selectedChannelId = 'general'
      this.#resetChannelForm()
      this.draft = ''
      this.#drafts.clear()
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
      this.#legacySpaces = await listChatSpaces(account, network, device)
      this.#spaces = new ChatSpaces({ device, send: async envelope => {
        if (!this.#transport) throw new Error('Chat is not connected.')
        if (!this.#transport.hasPendingMessage(envelope.id)) await this.#transport.sendDirect(envelope)
      } })
      this.#spaces.onChange = this.#refreshSpaces
      await this.#spaces.refresh()
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
      this.connected = true
      await this.#spaces.flush()
      this.#spaceRetry = setInterval(() => { void this.#spaces?.flush().catch(error => this.error = errorMessage(error)) }, 30000)
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
      await this.#spaces?.flush()
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
      if (!canReceiveSpaceMessage(space, envelope)) return
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
            channelId: envelope.channelId ?? 'general',
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
      if (opened.control) {
        await this.#spaces?.receive(opened.control, envelope.senderCertificate)
        await this.#acknowledgeControl(envelope)
        this.error = ''
        return
      }
      if (opened.text.startsWith('LFCSPACE1:')) {
        this.error = 'This legacy invitation cannot manage membership safely. Ask the owner for a new Space link.'
        await this.#acknowledgeControl(envelope)
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
    this.#rememberDraft()
    const certificate = this.devices.find(
      (device) => (device.peerId || device.account) === peerId || device.account === peerId
    )
    this.channel = 'direct'
    this.selectedSpaceId = ''
    this.selectedFriendPeerId = peerId
    this.selectedDeviceId = certificate?.deviceId || ''
    this.#restoreDraft()
    this.mobileConversation = true
    this.#stickToBottom = true
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
      this.#closePanel()
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

  #refreshSpaces = () => {
    const managed = this.#spaces?.spaces || []
    this.spaces = [...this.#legacySpaces.filter(space => !managed.some(item => item.spaceId === space.spaceId)), ...managed]
    this.managerQueue = this.#spaces?.queuedCount || 0
  }

  #onSpaceStorage = (event: StorageEvent) => {
    if (!this.device || !this.#spaces || event.key !== managedSpacesStorageKey(this.device)) return
    void this.#spaces.refresh().catch(error => this.error = errorMessage(error))
  }

  applyRouteParameters(params: Record<string, string>) {
    if (!params.invite) return
    this.inviteInput = params.invite
    void this.#previewInvitation()
  }

  #spaceAction = async (action: () => Promise<unknown>, message = '') => {
    if (this.busy) return
    this.busy = true
    this.error = ''
    try {
      await action()
      if (message) this.status = message
    } catch (error) {
      this.error = errorMessage(error)
    } finally {
      this.busy = false
    }
  }

  #acknowledgeControl = async (envelope: any) => {
    if (!this.device || !this.#transport) return
    await this.#transport.acknowledgeDelivery(await createDeliveryReceipt({
      messageId: envelope.id, recipientCertificate: this.device.certificate,
      signingKey: this.device.keys.signing.privateKey
    }))
    this.pendingCount = this.#transport.pendingCount
  }

  #previewInvitation = async () => {
    await this.#spaceAction(async () => {
      this.invitePreview = undefined
      const invite = await parseSpaceInvitation(this.inviteInput, getSelectedNetwork().network)
      this.invitePreview = invite
      await this.#openPanel('join')
    })
  }

  #requestSpaceJoin = async () => {
    if (!this.#spaces || !this.invitePreview) return
    await this.#spaceAction(async () => {
      await this.#spaces!.requestJoin(this.invitePreview)
      this.#selectSpace(this.invitePreview.spaceId)
      this.#closePanel()
    }, 'Join request queued. The owner must open Chat and approve your request.')
  }

  #createSpace = async (event: SubmitEvent) => {
    event.preventDefault()
    if (!this.#spaces || !this.spaceNameDraft.trim()) return
    await this.#spaceAction(async () => {
      const id = await this.#spaces!.create(this.spaceNameDraft)
      this.#selectSpace(id)
      this.spaceNameDraft = ''
      this.generatedInvite = ''
      this.#closePanel()
      await this.#openPanel('manage')
    }, 'Space created. Generate an invitation to bring your people in.')
  }

  #generateInvitation = async () => {
    if (!this.#spaces) return
    await this.#spaceAction(async () => {
      const invite = await this.#spaces!.createInvitation(this.selectedSpaceId)
      this.generatedInvite = spaceInvitationLink(invite)
      this.inviteQr = await qrcode.toDataURL(this.generatedInvite, { width: 400, margin: 2 })
    }, 'Invitation created. It expires in 24 hours and still requires owner approval.')
  }

  #copyInvitation = async () => {
    await this.#spaceAction(async () => {
      if (!navigator.clipboard) throw new Error('Clipboard is unavailable. Select and copy the link below.')
      await navigator.clipboard.writeText(this.generatedInvite)
    }, 'Invitation link copied.')
  }

  #inviteSpace = async (certificate: ChatCertificate) => {
    if (!this.#spaces) return
    await this.#spaceAction(async () => {
      const invite = await this.#spaces!.createInvitation(this.selectedSpaceId)
      await this.#spaces!.offer(invite, certificate)
    }, 'Invitation queued. The recipient must review it and request to join.')
  }

  #upgradeSpace = async () => {
    const space = this.spaces.find(item => item.spaceId === this.selectedSpaceId)
    if (!space || space.ownerAccount !== this.device?.account || !this.#spaces) return
    await this.#spaceAction(async () => {
      await this.#spaces!.create(space.name, space.spaceId)
    }, 'Space upgraded with a new key. Existing members must join again using a new invitation.')
  }

  #send = async (event: SubmitEvent) => {
    event.preventDefault()
    if (this.sending || !this.connected) return
    this.sending = true
    const draft = this.draft
    try {
      await this.#sendMessage(draft, this.#conversationKey())
    } finally {
      this.sending = false
    }
  }

  #clearSentDraft(draft: string, conversationKey: string) {
    if (this.#drafts.get(conversationKey) === draft) this.#drafts.delete(conversationKey)
    if (this.#conversationKey() === conversationKey && this.draft === draft) {
      this.draft = ''
      this.#scrollToBottom()
    }
  }

  async #sendMessage(draft: string, conversationKey: string) {
    if (!this.device || !this.#transport || !this.draft.trim()) return
    if (this.channel === 'space') {
      const space = this.spaces.find((candidate) => candidate.spaceId === this.selectedSpaceId)
      if (!space) {
        this.error = 'Choose a Space before sending a message.'
        return
      }
      const channelId = this.selectedChannelId
      if (!canSendToSpace(space, this.device.certificate, channelId)) {
        this.error = 'You need current Space membership before sending.'
        return
      }
      try {
        const id = crypto.randomUUID()
        const envelope = await sealSpaceMessage({
          id,
          spaceId: space.spaceId,
          text: draft,
          sender: { account: this.device.account, deviceId: this.device.deviceId },
          certificate: this.device.certificate,
          signingKey: this.device.keys.signing.privateKey,
          spaceKey: space.keyBytes,
          spaceEpoch: space.manifest.epoch,
          channelId
        })
        await this.#saveMessage({
          id,
          sender: this.device.account,
          spaceId: space.spaceId,
          channelId,
          text: draft.trim(),
          timestamp: envelope.timestamp,
          outgoing: true
        })
        await this.#transport.sendSpace(envelope)
        this.#clearSentDraft(draft, conversationKey)
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
        text: draft,
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
        text: draft.trim(),
        timestamp: envelope.timestamp,
        outgoing: true,
        deliveryState: 'queued'
      })
      await this.#transport.sendDirect(envelope)
      this.#clearSentDraft(draft, conversationKey)
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

  #icon(name: string) {
    const paths: Record<string, string> = {
      chat: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',
      plus: 'M12 5v14M5 12h14',
      search: 'm21 21-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
      back: 'm15 18-6-6 6-6',
      close: 'm6 6 12 12M6 18 18 6',
      send: 'm22 2-7 20-4-9-9-4 20-7ZM22 2 11 13',
      shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6',
      settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
      copy: 'M9 9h12v12H9zM5 15H3V3h12v2'
    }
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${paths[name] || paths.chat}></path></svg>`
  }

  #short(value: string) {
    return value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value
  }

  #sameConversation(message: ChatMessage, friend: string) {
    const account = this.devices.find(device => (device.peerId || device.account) === friend)?.account || friend
    return !message.spaceId && (message.conversationId === friend || message.conversationAccount === account)
  }

  #preview(messages: ChatMessage[], fallback: string) {
    const message = messages.at(-1)
    return message ? `${message.outgoing ? 'You: ' : ''}${message.text}` : fallback
  }

  static styles = css`
    :host {
      display: block; height: 100%; min-height: 0; min-width: 0; box-sizing: border-box;
      padding: clamp(8px, 1.6vw, 24px); color: var(--md-sys-color-on-surface, #eceef4);
      --chat-border: var(--lfc-glass-border, #363941);
      --chat-surface: var(--lfc-glass-surface, #20242b);
      --chat-muted: var(--md-sys-color-on-surface-variant, #aeb6c6);
      --chat-accent: var(--md-sys-color-primary, #8dbbff);
    }
    *, *::before, *::after { box-sizing: border-box; }
    .layout { display: grid; grid-template-columns: 304px minmax(0, 1fr); width: 100%; height: 100%; min-height: 0;
      overflow: hidden; border: 1px solid var(--chat-border); border-radius: 20px; background: var(--chat-surface); }
    .sidebar { display: flex; flex-direction: column; min-height: 0; min-width: 0; border-right: 1px solid var(--chat-border); }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 23px; letter-spacing: -.04em; }
    h2 { font-size: 17px; letter-spacing: -.02em; overflow-wrap: anywhere; }
    h3 { font-size: 15px; }
    .muted, .status { color: var(--chat-muted); font-size: 12px; line-height: 1.6; }
    svg { width: 20px; height: 20px; flex-shrink: 0; }
    button, input, select, textarea { font: inherit; color: inherit; }
    button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px;
      border: 1px solid var(--chat-border); border-radius: 12px; background: transparent; padding: 10px 14px; cursor: pointer; }
    button:hover { background: color-mix(in srgb, var(--chat-accent) 10%, transparent); }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible {
      outline: 2px solid var(--chat-accent); outline-offset: 3px; }
    .primary { background: var(--chat-accent); color: var(--md-sys-color-on-primary, #142b49); border-color: transparent; font-weight: 700; }
    .primary:hover:not(:disabled) { filter: brightness(1.08); background: var(--chat-accent); }
    .icon-button { padding: 10px; width: 42px; flex: 0 0 42px; }
    .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 22px 18px 16px; gap: 10px; }
    .sidebar-header p { margin-top: 3px; }
    .search { display: flex; align-items: center; gap: 8px; margin: 0 16px 16px; padding: 0 12px;
      border: 1px solid var(--chat-border); border-radius: 12px; color: var(--chat-muted); }
    .search input { width: 100%; min-width: 0; border: 0; background: transparent; outline-offset: 0; padding: 12px 0; font-size: 13px; }
    .conversation-list { flex: 1; min-height: 0; overflow: auto; padding: 0 10px 16px; }
    .section-title { display: flex; align-items: center; justify-content: space-between; padding: 12px 8px 8px;
      color: var(--chat-muted); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; }
    .section-title button { border: 0; min-height: 28px; padding: 4px; }
    .section-title svg { width: 16px; height: 16px; }
    .conversation-item { width: 100%; min-width: 0; border: 1px solid transparent; padding: 12px 10px; justify-content: flex-start; gap: 12px; text-align: left; }
    .conversation-item[aria-current="true"] { background: color-mix(in srgb, var(--chat-accent) 13%, transparent); border-color: color-mix(in srgb, var(--chat-accent) 22%, transparent); }
    .avatar { display: grid; place-items: center; width: 42px; height: 42px; flex: 0 0 42px; border-radius: 14px;
      background: color-mix(in srgb, var(--chat-accent) 14%, transparent); color: var(--chat-accent); font-weight: 700; font-size: 17px; }
    .avatar.space { border-radius: 12px; background: color-mix(in srgb, #b99aff 14%, transparent); color: #c5acff; }
    .item-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5px; }
    .item-copy strong, .item-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item-copy strong { font-size: 13px; font-weight: 650; }
    .item-copy small { color: var(--chat-muted); font-size: 12px; }
    .empty-list { padding: 14px 9px 24px; font-size: 12px; color: var(--chat-muted); line-height: 1.6; }
    .sidebar-footer { border-top: 1px solid var(--chat-border); padding: 12px; display: flex; gap: 8px; align-items: center; }
    .sidebar-footer > div { flex: 1; min-width: 0; }
    .sidebar-footer strong { display: block; font-size: 12px; }
    .sidebar-footer .icon-button { border: 0; }
    .connection-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 5px; background: var(--chat-muted); }
    .connection-dot.ready { background: #86d9b0; }
    .conversation { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: color-mix(in srgb, #10131b 18%, var(--chat-surface)); }
    .conversation-header { display: flex; align-items: center; gap: 12px; min-height: 90px; padding: 18px 26px; border-bottom: 1px solid var(--chat-border); }
    .conversation-header .heading { flex: 1; min-width: 0; }
    .encryption { display: inline-flex; align-items: center; gap: 5px; color: var(--chat-muted); font-size: 11px; margin-top: 5px; }
    .encryption svg { width: 13px; height: 13px; }
    .back { display: none; }
    .notice { margin: 12px 22px 0; padding: 10px 12px; border-radius: 10px; font-size: 12px; line-height: 1.6;
      background: color-mix(in srgb, var(--chat-accent) 7%, transparent); color: var(--chat-muted); overflow-wrap: anywhere; }
    .error { color: var(--md-sys-color-error, #ffb4ab); background: color-mix(in srgb, #ffb4ab 7%, transparent); }
    .messages { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 12px; padding: 24px clamp(16px, 3vw, 48px);
      overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; }
    .day { align-self: center; flex-shrink: 0; padding: 5px 12px; color: var(--chat-muted); font-size: 10px; border: 1px solid var(--chat-border); border-radius: 20px; margin: 8px 0; }
    .message { flex: 0 0 auto; width: fit-content; max-width: min(78%, 640px); align-self: flex-start; padding: 11px 15px;
      border: 1px solid var(--chat-border); border-radius: 15px 15px 15px 4px; background: var(--chat-surface); overflow-wrap: anywhere; }
    .message.outgoing { align-self: flex-end; border-radius: 15px 15px 4px 15px;
      border-color: color-mix(in srgb, var(--chat-accent) 17%, transparent); background: color-mix(in srgb, var(--chat-accent) 16%, var(--chat-surface)); }
    .message-sender { font-size: 11px; font-weight: 650; color: var(--chat-accent); margin-bottom: 5px; }
    .message-text { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
    .message-meta { display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 5px; color: var(--chat-muted); font-size: 10px; }
    .empty-conversation { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
      text-align: center; max-width: 360px; padding: 24px; margin: auto; }
    .empty-conversation .avatar { width: 64px; height: 64px; flex-basis: 64px; border-radius: 22px; margin-bottom: 4px; }
    .empty-conversation .avatar svg { width: 28px; height: 28px; }
    .empty-conversation h3 { font-size: 20px; letter-spacing: -.03em; }
    .composer { flex-shrink: 0; margin: 0 22px 18px; padding: 12px 14px; border: 1px solid var(--chat-border); border-radius: 16px; background: var(--chat-surface); }
    .compose { display: flex; gap: 12px; align-items: flex-end; }
    textarea { display: block; flex: 1; width: 100%; min-width: 0; min-height: 42px; max-height: 160px; resize: none;
      border: 0; border-radius: 6px; padding: 10px 2px; background: transparent; font-size: 14px; line-height: 22px; }
    .send { width: 42px; padding: 10px; flex: 0 0 42px; }
    .compose-hint { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0 0; font-size: 10px; color: var(--chat-muted); }
    .recipient-device { margin-bottom: 10px; }
    .recipient-device label { font-size: 11px; color: var(--chat-muted); display: flex; gap: 8px; align-items: center; }
    select { max-width: 100%; min-width: 0; background: var(--chat-surface); padding: 6px; border-radius: 8px; border: 1px solid var(--chat-border); }
    dialog { position: fixed; width: min(480px, calc(100vw - 32px)); max-height: min(85dvh, 720px); overflow: auto;
      color: inherit; background: var(--chat-surface); border: 1px solid var(--chat-border); border-radius: 20px; padding: 24px; }
    dialog::backdrop { background: #090c14b8; backdrop-filter: blur(4px); }
    .dialog-header { display: flex; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .dialog-header h2 { font-size: 21px; }
    .dialog-form { display: grid; gap: 16px; }
    .dialog-form label { display: grid; gap: 8px; font-size: 13px; }
    .dialog-form input { width: 100%; border: 1px solid var(--chat-border); border-radius: 10px; padding: 12px; background: transparent; }
    .dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .settings-group { border-top: 1px solid var(--chat-border); margin-top: 20px; padding-top: 20px; display: grid; gap: 12px; }
    .device { display: grid; gap: 8px; border: 1px solid var(--chat-border); padding: 12px; border-radius: 12px; }
    .device-id { color: var(--chat-muted); font-size: 11px; overflow-wrap: anywhere; }
    .archive-setting { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.5; }
    .archive-setting input { margin: 3px 0 0; width: 17px; height: 17px; accent-color: var(--chat-accent); flex: 0 0 17px; }
    .space-actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 14px; }
    .space-actions button { flex: 1; min-height: 34px; padding: 7px 10px; font-size: 12px; }
    .invite-link { width: 100%; min-height: 90px; resize: vertical; border: 1px solid var(--chat-border); padding: 12px; font-size: 11px; }
    .invite-qr { display: block; width: min(320px, 100%); height: auto; padding: 8px; margin: auto; background: white; border-radius: 12px; }
    .member-row { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 12px 0; border-bottom: 1px solid var(--chat-border); }
    .member-row > div { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .member-row button { min-height: 34px; padding: 6px 10px; font-size: 12px; }
    .danger { color: var(--md-sys-color-error, #ffb4ab); }
    .confirmation { display: grid; gap: 12px; margin-top: 12px; padding: 14px; border: 1px solid var(--chat-border); border-radius: 12px; }
    .channel-list { display: grid; gap: 3px; margin: 3px 8px 10px 31px; padding-left: 12px; border-left: 1px solid var(--chat-border); }
    .channel-item { justify-content: flex-start; width: 100%; padding: 7px 9px; min-height: 34px; border-color: transparent; font-size: 12px; color: var(--chat-muted); }
    .channel-item[aria-current="true"] { color: var(--chat-accent); background: color-mix(in srgb, var(--chat-accent) 10%, transparent); }
    .channel-item small { margin-left: auto; font-size: 10px; }
    .channel-topic { font-size: 11px; color: var(--chat-muted); line-height: 1.5; margin-top: 4px; overflow-wrap: anywhere; }
    .channel-controls { display: flex; flex-wrap: wrap; gap: 6px; }
    .channel-form { margin-top: 12px; padding: 14px; border: 1px solid var(--chat-border); border-radius: 12px; }
    .channel-form textarea { border: 1px solid var(--chat-border); padding: 10px; min-height: 74px; }
    .role-badge { display: inline-block; margin-top: 5px; padding: 3px 7px; border-radius: 6px; background: color-mix(in srgb, var(--chat-accent) 12%, transparent); color: var(--chat-accent); font-size: 10px; }
    .role-badge.moderator { color: #c5acff; background: color-mix(in srgb, #c5acff 12%, transparent); }
    .status { overflow-wrap: anywhere; }
    @media (max-width: 980px) { .layout { grid-template-columns: 260px minmax(0, 1fr); } }
    @media (max-width: 700px) {
      :host { padding: 0; }
      .layout { display: flex; border: 0; border-radius: 0; }
      .sidebar { width: 100%; border: 0; }
      .conversation { display: none; width: 100%; }
      .layout.show-conversation .sidebar { display: none; }
      .layout.show-conversation .conversation { display: flex; }
      .back { display: inline-flex; border: 0; flex-basis: 36px; width: 36px; padding: 6px; }
      .conversation-header { padding: 12px; min-height: 76px; gap: 8px; }
      .conversation-header .avatar { width: 36px; height: 36px; flex-basis: 36px; font-size: 14px; }
      .conversation-header h2 { font-size: 15px; }
      .conversation-header .encryption { font-size: 10px; }
      .messages { padding: 12px; gap: 10px; }
      .message { max-width: 88%; }
      .composer { margin: 0 10px 10px; padding: 8px 10px; }
      .compose-hint .keyboard-hint { display: none; }
      .notice { margin: 8px 10px 0; }
      .sidebar-header { padding: 20px 18px; }
      dialog { padding: 20px; }
    }
  `

  render() {
    const selectedCertificate = this.devices.find(device => device.deviceId === this.selectedDeviceId)
    const selectedSpace = this.spaces.find(space => space.spaceId === this.selectedSpaceId)
    const channels = spaceChannels(selectedSpace)
    const selectedChannel = channels.find(item => item.id === this.selectedChannelId)
    const spaceWritable = canSendToSpace(selectedSpace, this.device?.certificate, this.selectedChannelId)
    const joinedSpace = canSendToSpace(selectedSpace, this.device?.certificate)
    const role = spaceRole(selectedSpace, this.device?.certificate)
    const managesChannels = role === 'owner' || role === 'moderator'
    const pendingChannels = selectedSpace?.channelRequests?.filter(request => request.status === 'pending').length || 0
    const lastChannelRequest = selectedSpace?.channelRequests?.at(-1)
    const ownsSpace = Boolean(selectedSpace?.manifest && this.device?.certificate &&
      selectedSpace.manifest.authority.deviceId === this.device.deviceId &&
      selectedSpace.manifest.authority.signingKey === this.device.certificate.signingKey)
    const active = this.channel === 'space' ? Boolean(selectedSpace) : Boolean(this.selectedFriendPeerId)
    const title = this.channel === 'space' ? selectedSpace?.name : this.#short(this.selectedFriendPeerId)
    const conversationMessages = active ? this.messages.filter(message => this.channel === 'space'
      ? message.spaceId === this.selectedSpaceId && (message.channelId ?? 'general') === this.selectedChannelId
      : this.#sameConversation(message, this.selectedFriendPeerId)) : []
    const recipientDevices = this.devices.filter(certificate => certificate.account !== this.device?.account &&
      ((certificate.peerId || certificate.account) === this.selectedFriendPeerId || certificate.account === this.selectedFriendPeerId))
    const friends = [...new Set([...this.friends, ...this.messages.filter(message => !message.spaceId)
      .map(message => message.conversationId || message.conversationAccount).filter(Boolean)])] as string[]
    friends.sort((a, b) => (this.messages.findLast(message => this.#sameConversation(message, b))?.timestamp || 0)
      - (this.messages.findLast(message => this.#sameConversation(message, a))?.timestamp || 0))
    const search = this.search.trim().toLowerCase()
    const filteredFriends = friends.filter(friend => friend.toLowerCase().includes(search) ||
      this.messages.some(message => this.#sameConversation(message, friend) && message.text.toLowerCase().includes(search)))
    const filteredSpaces = this.spaces.filter(space => space.name.toLowerCase().includes(search) ||
      this.messages.some(message => message.spaceId === space.spaceId && message.text.toLowerCase().includes(search)))
    const canSend = this.connected && Boolean(this.device) && !this.sending && Boolean(this.draft.trim()) &&
      (this.channel === 'space' ? spaceWritable : Boolean(selectedCertificate))
    const dateLabel = (timestamp: number) => {
      const date = new Date(timestamp)
      const today = new Date()
      if (date.toDateString() === today.toDateString()) return 'Today'
      const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
      return date.toDateString() === yesterday.toDateString() ? 'Yesterday'
        : date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    }

    return html`
      <main class=${`layout ${this.mobileConversation ? 'show-conversation' : ''}`}>
        <aside class="sidebar" aria-label="Conversations">
          <header class="sidebar-header">
            <div><h1>Messages</h1><p class="muted">Your people. Your conversations.</p></div>
            <button class="icon-button primary" type="button" aria-label="New conversation" title="New conversation"
              @click=${() => this.#openPanel('friend')}>${this.#icon('plus')}</button>
          </header>
          <label class="search">${this.#icon('search')}
            <input type="search" placeholder="Search conversations" aria-label="Search conversations" .value=${this.search}
              @input=${(event: Event) => this.search = (event.currentTarget as HTMLInputElement).value} />
          </label>
          <div class="space-actions"><button type="button" @click=${() => this.#openPanel('space')}>${this.#icon('plus')}Create Space</button>
            <button type="button" @click=${() => { this.invitePreview = undefined; this.inviteInput = ''; void this.#openPanel('join') }}>Join Space</button></div>
          <div class="conversation-list">
            <div class="section-title"><span>Direct messages · ${friends.length}</span></div>
            ${filteredFriends.map(friend => {
              const messages = this.messages.filter(message => this.#sameConversation(message, friend))
              const known = this.devices.some(device => (device.peerId || device.account) === friend || device.account === friend)
              return html`<button class="conversation-item friend-item" type="button" title=${friend}
                aria-current=${this.channel === 'direct' && this.selectedFriendPeerId === friend ? 'true' : 'false'}
                @click=${() => this.#selectFriend(friend)}>
                <span class="avatar" aria-hidden="true">${this.#icon('chat')}</span>
                <span class="item-copy"><strong>${this.#short(friend)}</strong><small>${this.#preview(messages, known ? 'Start a conversation' : 'Waiting for device')}</small></span>
              </button>`
            })}
            ${!filteredFriends.length ? html`<p class="empty-list">${search ? 'No matching direct messages.' : 'Start with a friend’s Peernet ID. New conversations will appear here.'}</p>` : ''}
            <div class="section-title"><span>Spaces · ${this.spaces.length}</span>
              <button type="button" aria-label="Create Space" title="Create Space" @click=${() => this.#openPanel('space')}>${this.#icon('plus')}</button>
            </div>
            ${filteredSpaces.map(space => html`<div class="space-entry"><button class="conversation-item space-item" type="button"
              aria-current=${this.channel === 'space' && this.selectedSpaceId === space.spaceId ? 'true' : 'false'}
              @click=${() => this.#selectSpace(space.spaceId)}>
              <span class="avatar space" aria-hidden="true">#</span>
              <span class="item-copy"><strong>${space.name}</strong><small>${space.status && space.status !== 'joined'
                ? ({offered:'Invitation received',requested:'Waiting for approval',left:'You left this Space',removed:'Membership removed',denied:'Request declined'}[space.status] || space.status)
                : this.#preview(this.messages.filter(message => message.spaceId === space.spaceId), space.manifest ? `${space.manifest.members.length} member devices` : 'Legacy Space · upgrade required')}</small></span>
            </button>
            ${this.channel === 'space' && this.selectedSpaceId === space.spaceId && space.status === 'joined' ? html`<nav class="channel-list" aria-label=${`Channels in ${space.name}`}>
              ${spaceChannels(space).filter(item => !item.archived || item.id === this.selectedChannelId).map(item => html`<button
                class="channel-item" type="button" data-channel=${item.id} aria-current=${item.id === this.selectedChannelId ? 'true' : 'false'}
                @click=${() => this.#selectSpaceChannel(space.spaceId, item.id)}><span aria-hidden="true">#</span>${item.name}${item.archived ? html`<small>Archived</small>` : ''}</button>`)}
              ${managesChannels ? html`<button class="channel-item" type="button" @click=${() => { this.#resetChannelForm(); void this.#openPanel('manage') }}>+ Manage channels</button>` : ''}
            </nav>` : ''}</div>`)}
            ${!filteredSpaces.length ? html`<p class="empty-list">${search ? 'No matching Spaces.' : 'A private place for your group. Create a Space or receive an invitation.'}</p>` : ''}
          </div>
          <footer class="sidebar-footer">
            <span class="avatar" aria-hidden="true">${this.#icon('shield')}</span>
            <div><strong><span class=${`connection-dot ${this.connected ? 'ready' : ''}`}></span>${this.connected ? 'Chat connected' : 'Not connected'}</strong>
              <span class="muted">${this.pendingCount ? `${this.pendingCount} pending delivery` : 'End-to-end encrypted'}</span></div>
            <button class="icon-button" type="button" aria-label="Chat settings" title="Chat settings" @click=${() => this.#openPanel('settings')}>${this.#icon('settings')}</button>
          </footer>
        </aside>

        <section class="conversation" aria-label="Conversation">
          <header class="conversation-header">
            <button class="icon-button back" type="button" aria-label="Back to conversations"
              @click=${() => this.mobileConversation = false}>${this.#icon('back')}</button>
            <span class=${`avatar ${this.channel === 'space' ? 'space' : ''}`} aria-hidden="true">${this.channel === 'space' ? '#' : this.#icon('chat')}</span>
            <div class="heading"><h2 title=${this.channel === 'direct' ? this.selectedFriendPeerId : ''}>${title || 'Your conversations'}${this.channel === 'space' && selectedChannel ? html` · #${selectedChannel.name}` : ''}</h2>
              <span class="encryption">${this.#icon('shield')}${active ? 'End-to-end encrypted' : 'Private by design'}</span>
              ${this.channel === 'space' && selectedChannel?.topic ? html`<p class="channel-topic">${selectedChannel.topic}</p>` : ''}</div>
            ${active ? html`<button class="icon-button" type="button" aria-label="Conversation settings" title="Devices and invitations"
              @click=${() => this.#openPanel(this.channel === 'space' ? 'manage' : 'settings')}>${this.#icon('settings')}</button>` : ''}
          </header>
          ${this.error ? html`<p class="notice error" role="alert">${this.error}</p>` : ''}
          ${active && !this.connected ? html`<p class="notice" role="status">${this.status}</p>` : ''}
          ${this.channel === 'space' && active && !spaceWritable ? html`<section class="notice" role="status">
            ${joinedSpace && selectedChannel?.archived ? html`This channel is archived. Its local history is still available, but new messages are disabled.`
              : !selectedSpace?.manifest && !selectedSpace?.status ? html`This legacy Space needs managed membership before you can send.
              <button type="button" @click=${() => this.#openPanel('manage')}>View upgrade options</button>`
              : selectedSpace?.status === 'requested' ? html`Waiting for owner approval. Keep Chat open; the owner must open Chat to process your request.
                <button type="button" ?disabled=${this.busy} @click=${() => this.#spaceAction(() => this.#spaces!.leave(this.selectedSpaceId), 'Join request cancelled.')}>Cancel request</button>`
                : html`${selectedSpace?.status === 'offered' ? 'You have been invited. Review the invitation before requesting access.' : 'You do not have current membership in this Space.'}
                  ${selectedSpace?.invitation ? html`<button type="button" @click=${() => { this.inviteInput = spaceInvitationLink(selectedSpace.invitation); void this.#previewInvitation() }}>Review invitation</button>` : ''}`}
          </section>` : ''}
          ${this.managerQueue ? html`<p class="notice" role="status">${this.managerQueue} Space update(s) queued for sending. Keep Chat open to retry.</p>` : ''}
          ${this.channel === 'space' && pendingChannels ? html`<p class="notice" role="status">${pendingChannels} channel change(s) awaiting the owner device. Keep Chat open; the owner must be online to authorize them.</p>` : ''}
          ${this.channel === 'space' && lastChannelRequest?.status === 'rejected' ? html`<p class="notice error" role="alert">Channel change declined: ${lastChannelRequest.error}</p>` : ''}
          ${this.channel === 'direct' && active && !selectedCertificate
            ? html`<p class="notice">Waiting for a recipient device. Keep Chat open on the same network to discover each other.</p>` : ''}
          <div class="messages" role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text"
            @scroll=${(event: Event) => {
              const list = event.currentTarget as HTMLElement
              this.#stickToBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 100
            }}>
            ${conversationMessages.length ? conversationMessages.map((message, index) => html`
              ${index === 0 || new Date(conversationMessages[index - 1].timestamp).toDateString() !== new Date(message.timestamp).toDateString()
                ? html`<span class="day">${dateLabel(message.timestamp)}</span>` : ''}
              <article class=${message.outgoing ? 'message outgoing' : 'message'} aria-label=${message.outgoing ? 'Your message' : 'Received message'}>
                ${!message.outgoing && this.channel === 'space' ? html`<p class="message-sender" title=${message.sender}>${this.#short(message.sender)}</p>` : ''}
                <p class="message-text">${message.text}</p>
                <footer class="message-meta"><time datetime=${new Date(message.timestamp).toISOString()}>${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                  ${message.deliveryState ? html`<span class="message-state">${message.deliveryState === 'delivered' ? 'Delivered' : 'Pending delivery'}</span>` : ''}
                </footer>
              </article>`)
              : html`<div class="empty-conversation"><span class="avatar" aria-hidden="true">${this.#icon('chat')}</span>
                  <h3>${active ? 'Say hello' : 'A little closer, wherever you are.'}</h3>
                  <p class="muted">${active ? this.channel === 'space'
                    ? 'Only invited members can read this Space. Send the first message while they’re online.'
                    : 'Your conversation starts here. Messages are encrypted between your device keys.'
                    : 'Message a friend or bring your people together in a private Space.'}</p>
                  ${!active ? html`<button class="primary" type="button" @click=${() => this.#openPanel('friend')}>${this.#icon('plus')}New conversation</button>` : ''}
                </div>`}
          </div>
          ${active && (this.channel === 'direct' || spaceWritable) ? html`<form class="composer" @submit=${this.#send} aria-label="Send message">
            ${this.channel === 'direct' && recipientDevices.length > 1 ? html`<div class="recipient-device"><label>Send to device
              <select .value=${this.selectedDeviceId} @change=${this.#selectDevice} aria-label="Recipient device">
                ${recipientDevices.map(certificate => html`<option value=${certificate.deviceId}>${certificate.deviceId.slice(0, 12)}</option>`)}
              </select></label></div>` : ''}
            <div class="compose"><textarea .value=${this.draft} rows="1" maxlength="4000" placeholder="Write a message…"
              aria-label="Message" @input=${this.#composerInput} @keydown=${this.#composerKeydown}
              ?disabled=${!this.connected || this.sending || (this.channel === 'direct' && !selectedCertificate)}></textarea>
              <button class="send primary" type="submit" aria-label=${this.sending ? 'Sending message' : 'Send message'} title="Send message"
                ?disabled=${!canSend}>${this.#icon('send')}</button></div>
            <div class="compose-hint"><span class="keyboard-hint">Enter to send · Shift + Enter for a new line</span><span>${this.sending ? 'Sending…' : `${this.draft.length} / 4000`}</span></div>
          </form>` : ''}
        </section>
      </main>

      ${this.panel ? html`<dialog aria-labelledby="chat-dialog-title" @cancel=${(event: Event) => { event.preventDefault(); this.#closePanel() }} @close=${(event: Event) => {
        const dialog = event.currentTarget as HTMLDialogElement
        if (!dialog.open && dialog === this.renderRoot.querySelector('dialog')) this.panel = ''
      }}>
        <header class="dialog-header"><h2 id="chat-dialog-title">${this.panel === 'friend' ? 'New conversation' : this.panel === 'space' ? 'Create a Space' : this.panel === 'join' ? 'Join a Space' : this.panel === 'manage' ? selectedSpace?.name || 'Space settings' : 'Chat settings'}</h2>
          <button class="icon-button" type="button" aria-label="Close dialog" @click=${this.#closePanel}>${this.#icon('close')}</button></header>
        ${this.panel === 'friend' ? html`<form class="dialog-form" @submit=${this.#addFriend}>
          <label>Friend’s Peernet ID<input .value=${this.friendAddressDraft} autofocus required maxlength="128" autocomplete="off"
            placeholder="Paste a Peernet ID" @input=${(event: Event) => this.friendAddressDraft = (event.currentTarget as HTMLInputElement).value} /></label>
          <p class="muted">Ask your friend to copy their ID from Chat settings. Both devices need to open Chat on the same network to discover each other.</p>
          <div class="dialog-actions"><button type="button" @click=${this.#closePanel}>Cancel</button><button class="primary" type="submit"
            ?disabled=${!this.device || !this.friendAddressDraft.trim()}>Start conversation</button></div></form>` : ''}
        ${this.panel === 'space' ? html`<form class="dialog-form" @submit=${this.#createSpace}>
          <label>Space name<input .value=${this.spaceNameDraft} autofocus required maxlength="80" placeholder="e.g. Friends & family"
            @input=${(event: Event) => this.spaceNameDraft = (event.currentTarget as HTMLInputElement).value} /></label>
          <p class="muted">An encrypted group for people you invite. Generate a shareable link after creating it, then approve requests to join.</p>
          <div class="dialog-actions"><button type="button" @click=${this.#closePanel}>Cancel</button><button class="primary" type="submit"
            ?disabled=${this.busy || !this.device || !this.spaceNameDraft.trim()}>Create Space</button></div></form>` : ''}
        ${this.panel === 'join' ? html`<form class="dialog-form" @submit=${(event: SubmitEvent) => { event.preventDefault(); void this.#previewInvitation() }}>
          <label>Invitation link<input autofocus .value=${this.inviteInput} maxlength="16000" placeholder="Paste a Space invitation link"
            @input=${(event: Event) => { this.inviteInput = (event.currentTarget as HTMLInputElement).value; this.invitePreview = undefined }} /></label>
          <p class="muted">Opening a link never joins automatically. A link contains public Space information, not the encryption key.</p>
          <button type="submit" ?disabled=${this.busy || !this.inviteInput.trim()}>Preview invitation</button>
          ${this.invitePreview ? html`<section class="settings-group"><span class="avatar space" aria-hidden="true">#</span><h3>${this.invitePreview.name}</h3>
            <p class="device-id">Owner: ${this.invitePreview.ownerAccount}</p><p class="muted">Network: ${this.invitePreview.network}<br />Expires: ${new Date(this.invitePreview.expiresAt).toLocaleString()}</p>
            <p class="muted">The owner must approve your device before it receives a group key. Current limit: 8 member devices per Space.</p>
            <div class="dialog-actions"><button type="button" @click=${this.#closePanel}>Cancel</button>
              <button class="primary" type="button" ?disabled=${this.busy || !this.connected} @click=${this.#requestSpaceJoin}>Request to join</button></div>
          </section>` : ''}
        </form>` : ''}
        ${this.panel === 'manage' && selectedSpace ? html`
          <p class="status" role="status">${this.status}</p>
          ${!selectedSpace.manifest && selectedSpace.status ? html`<section class="settings-group"><h3>Membership: ${selectedSpace.status}</h3>
            <p class="muted">Opening an invitation is not membership. Review the link and request access, then wait for the owner to approve your device.</p>
            ${selectedSpace.invitation && selectedSpace.status !== 'requested' ? html`<button type="button" @click=${() => {
              this.inviteInput = spaceInvitationLink(selectedSpace.invitation); void this.#previewInvitation()
            }}>Review invitation</button>` : ''}
          </section>` : !selectedSpace.manifest ? html`<section class="settings-group"><h3>Upgrade legacy membership</h3>
            <p class="muted">The old Space format cannot revoke membership. Upgrading preserves local messages but creates a fresh key. Existing members must request access again.</p>
            ${selectedSpace.ownerAccount === this.device?.account ? html`<button class="primary" type="button" ?disabled=${this.busy} @click=${this.#upgradeSpace}>Upgrade Space</button>`
              : html`<p class="muted">Ask the owner for a new invitation link.</p>`}</section>` : html`
            <p class="muted">${selectedSpace.manifest.members.length} / 8 member devices · Membership revision ${selectedSpace.manifest.revision}</p>
            <section class="settings-group"><h3>Channels · ${channels.length} / 12</h3>
              <p class="muted">Channels organize conversations inside this Space. Every member can read every channel; these are not private permission groups.</p>
              ${role === 'moderator' ? html`<p class="muted">You can manage channels. Changes become active after the owner device verifies and signs them. You cannot change roles or membership.</p>` : ''}
              ${channels.map(item => html`<div class="member-row"><div><strong>#${item.name}${item.archived ? ' · Archived' : ''}</strong>
                ${item.topic ? html`<p class="muted">${item.topic}</p>` : ''}</div>
                <div class="channel-controls"><button type="button" aria-label=${`Open channel ${item.name}`} @click=${() => {
                  this.#selectSpaceChannel(selectedSpace.spaceId,item.id); this.#closePanel()
                }}>${item.archived ? 'Open history' : 'Open'}</button>
                ${managesChannels ? html`<button type="button" aria-label=${`Edit channel ${item.name}`} @click=${() => this.#editChannel(item)}>Edit</button>
                  ${item.id !== 'general' ? html`<button type="button" ?disabled=${this.busy} aria-label=${`${item.archived ? 'Restore' : 'Archive'} channel ${item.name}`}
                    @click=${() => this.#changeChannel({action:item.archived ? 'restore' : 'archive',channelId:item.id,expectedVersion:item.version})}>${item.archived ? 'Restore' : 'Archive'}</button>` : ''}` : ''}</div></div>`)}
              ${managesChannels ? html`<form class="dialog-form channel-form" @submit=${this.#saveChannel}>
                <h3>${this.channelEditingId ? 'Edit channel' : 'Create channel'}</h3>
                <label>Channel name<input aria-label="Channel name" .value=${this.channelNameDraft} required maxlength="32" placeholder="e.g. development"
                  @input=${(event: Event) => this.channelNameDraft = (event.currentTarget as HTMLInputElement).value} /></label>
                <label>Topic<textarea aria-label="Channel topic" .value=${this.channelTopicDraft} maxlength="120" rows="2" placeholder="What is this conversation about?"
                  @input=${(event: Event) => this.channelTopicDraft = (event.currentTarget as HTMLTextAreaElement).value}></textarea></label>
                <div class="dialog-actions">${this.channelEditingId ? html`<button type="button" @click=${this.#resetChannelForm}>Cancel editing</button>` : ''}
                  <button class="primary" type="submit" ?disabled=${this.busy || !this.channelNameDraft.trim() || (!this.channelEditingId && channels.length >= 12)}>${this.channelEditingId ? 'Save channel' : 'Create channel'}</button></div>
              </form>` : ''}
              ${(selectedSpace.channelRequests || []).slice(-3).map(request => html`<p class=${request.status === 'rejected' ? 'muted danger' : 'muted'} role="status">
                Channel change: ${request.status}${request.error ? ` — ${request.error}` : ''}</p>`)}
            </section>
            ${ownsSpace ? html`<section class="settings-group"><h3>Invite people</h3>
              <p class="muted">Links expire after 24 hours. You approve each join request from this owner device. Keep Chat open to process requests.</p>
              <button class="primary" type="button" ?disabled=${this.busy} @click=${this.#generateInvitation}>Generate invitation</button>
              ${this.generatedInvite ? html`<label class="muted">Shareable invitation<textarea class="invite-link" readonly .value=${this.generatedInvite} aria-label="Space invitation link"></textarea></label>
                <button type="button" @click=${this.#copyInvitation}>${this.#icon('copy')}Copy invitation link</button>
                ${this.inviteQr ? html`<img class="invite-qr" src=${this.inviteQr} alt="QR code for the Space invitation" />` : ''}` : ''}
              ${(selectedSpace.invites || []).map(invite => html`<div class="member-row"><div><strong>Invitation ${invite.id.slice(0,8)}</strong><p class="muted">Expires ${new Date(invite.expiresAt).toLocaleString()}</p></div>
                <button type="button" ?disabled=${this.busy} @click=${() => this.#spaceAction(async () => { await this.#spaces!.revokeInvitation(selectedSpace.spaceId, invite.id); this.generatedInvite = ''; this.inviteQr = '' }, 'Invitation revoked. It can no longer be approved.')}>Revoke</button></div>`)}
            </section><section class="settings-group"><h3>Join requests · ${selectedSpace.requests?.length || 0}</h3>
              ${(selectedSpace.requests || []).map(request => html`<article class="device"><strong>${this.#short(request.certificate.account)}</strong><span class="device-id">Device ${request.certificate.deviceId}</span>
                <div class="dialog-actions"><button type="button" ?disabled=${this.busy} @click=${() => this.#spaceAction(() => this.#spaces!.deny(selectedSpace.spaceId, request.requestId), 'Join request declined.')}>Decline</button>
                  <button class="primary" type="button" ?disabled=${this.busy} @click=${() => this.#spaceAction(() => this.#spaces!.approve(selectedSpace.spaceId, request.requestId), 'Membership approved. Encrypted key update queued for delivery.')}>Approve</button></div></article>`)}
              ${selectedSpace.requests?.length ? '' : html`<p class="muted">People who request access through your invitations appear here.</p>`}</section>` : ''}
            <section class="settings-group"><h3>Members</h3>
              ${selectedSpace.manifest.members.map(member => html`<div class="member-row"><div><strong>${this.#short(member.account)}</strong>
                <p class="device-id">${member.deviceId}</p><span class=${`role-badge ${spaceRole(selectedSpace,member.account) === 'moderator' ? 'moderator' : ''}`}>${member.account === selectedSpace.ownerAccount ? 'Owner' : spaceRole(selectedSpace,member.account) === 'moderator' ? 'Moderator' : 'Member'}</span></div>
                ${ownsSpace && member.account !== selectedSpace.ownerAccount ? html`<div class="channel-controls">
                  <button class="moderator-role" type="button" ?disabled=${this.busy} @click=${() => this.#spaceAction(() => this.#spaces!.setModerator(selectedSpace.spaceId,member.account,spaceRole(selectedSpace,member.account) !== 'moderator'),
                    'Moderator role updated. Signed permissions are queued for delivery.')}>${spaceRole(selectedSpace,member.account) === 'moderator' ? 'Remove moderator' : 'Make moderator'}</button>
                  <button class="danger" type="button" ?disabled=${this.busy} @click=${() => this.confirmRemoval = member.account}>Remove</button></div>` : ''}</div>`)}
              ${ownsSpace ? html`<p class="muted">Moderators can manage channels, not roles, invitations or membership. The role applies to that account’s current member devices.</p>` : ''}
              <p class="muted">Membership changes rotate the key for future messages. Removed members may retain messages and keys they already received. Removal also revokes existing invitation links.</p>
              ${!ownsSpace && selectedSpace.status === 'joined' ? html`<button class="danger" type="button" @click=${() => this.confirmRemoval = 'self'}>Leave Space</button>` : ''}
              ${this.confirmRemoval ? html`<div class="confirmation"><strong>${this.confirmRemoval === 'self' ? 'Leave this Space?' : 'Remove this member’s devices?'}</strong>
                <div class="dialog-actions"><button type="button" @click=${() => this.confirmRemoval = ''}>Cancel</button>
                  <button class="danger" type="button" ?disabled=${this.busy} @click=${() => this.#spaceAction(async () => {
                    if (this.confirmRemoval === 'self') await this.#spaces!.leave(selectedSpace.spaceId)
                    else await this.#spaces!.remove(selectedSpace.spaceId, this.confirmRemoval)
                    this.confirmRemoval = ''; this.generatedInvite = ''; this.inviteQr = ''
                  }, 'Membership updated. Key changes are queued for delivery.')}>Confirm</button></div></div>` : ''}
            </section>`}
            ${selectedSpace.status && selectedSpace.status !== 'joined' && selectedSpace.status !== 'requested' ? html`<section class="settings-group">
              <button type="button" ?disabled=${this.busy || Boolean(this.managerQueue)} @click=${() => this.#spaceAction(async () => {
                await this.#spaces!.forget(selectedSpace.spaceId); this.selectedSpaceId = ''; this.mobileConversation = false; this.#closePanel()
              }, 'Space removed from this device.')}>Forget Space on this device</button></section>` : ''}
        ` : ''}
        ${this.panel === 'settings' ? html`
          <p class="status" role="status">${this.status}</p>
          <section class="settings-group"><h3>Your Peernet ID</h3><p class="device-id">${this.device?.peerId || 'Connect to the node first.'}</p>
            <button type="button" ?disabled=${!this.device} @click=${this.#copyOwnPeernetId}>${this.#icon('copy')}Copy my ID</button></section>
          <section class="settings-group"><h3>Offline delivery</h3>
            <label class="archive-setting"><input type="checkbox" .checked=${this.archiveEnabled} ?disabled=${!this.connected}
              @change=${this.#setArchiveEnabled} /><span><strong>Offer encrypted DM archiving</strong><br />Temporarily store ciphertext for offline devices.</span></label>
            <p class="muted">${this.archiveCount} archived · ${this.pendingCount} pending delivery</p>
            <p class="muted">Opt-in only. Reachable copies are removed after a verified receipt. This does not guarantee every copy is erased.</p></section>
          <section class="settings-group"><h3>Discovered devices · ${this.devices.length}</h3>
            <p class="muted">Approve only devices you recognize and control. Discovery does not mean a device is currently online.</p>
            ${this.devices.map(certificate => html`<article class="device"><strong>${this.#short(certificate.account)}</strong><span class="device-id">${certificate.deviceId}</span>
              ${certificate.account === this.device?.account && certificate.deviceId !== this.device?.deviceId
                ? html`<button type="button" @click=${() => this.#approveDevice(certificate)}>Approve device</button>` : ''}
              ${this.channel === 'space' && ownsSpace && certificate.account !== this.device?.account
                ? html`<button type="button" @click=${() => this.#inviteSpace(certificate)}>Invite to ${selectedSpace.name}</button>` : ''}
            </article>`)}
            ${!this.devices.length ? html`<p class="muted">No devices discovered yet. Keep Chat open on the same network.</p>` : ''}
          </section>` : ''}
        ${this.error ? html`<p class="notice error" role="alert">${this.error}</p>` : ''}
      </dialog>` : ''}
    `
  }
}
