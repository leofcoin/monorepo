import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import {
  loadOrCreateChatDevice,
  listChatSpaces,
  listKnownChatDevices,
  listTrustedChatDevices,
  rememberChatDevice,
  saveChatDeviceCertificate,
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
  encryptionKey: string
  signingKey: string
  [key: string]: unknown
}

interface ChatDevice {
  account: string
  network: string
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
  conversationAccount?: string
  spaceId?: string
  text: string
  timestamp: number
  outgoing: boolean
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
  @state() accessor spaces: ChatSpace[] = []
  @state() accessor selectedSpaceId = ''
  @state() accessor channel: 'direct' | 'space' = 'direct'
  @state() accessor selectedDeviceId = ''
  @state() accessor draft = ''
  @state() accessor spaceNameDraft = ''
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
      this.spaces = []
    }
    this.#starting = true
    this.#requestedWallet = identityKey
    this.error = ''
    try {
      const signer = await globalThis.identityController.signer(account)
      const device = await loadOrCreateChatDevice({
        account,
        network,
        signWithAccount: signer.sign
      })
      if (!this.#connected) return
      this.device = device
      trustChatDevice(device.certificate)
      this.devices = listKnownChatDevices(network)
      this.spaces = await listChatSpaces(account, network, device)
      this.#transport = createChatTransport({
        peernet: globalThis.peernet,
        network,
        identityProvider: async () => ({
          account: this.device?.account,
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
      this.status = 'Message delivery confirmed.'
      return
    }
    if (event.type === 'device' && event.certificate) {
      rememberChatDevice(event.certificate)
      this.devices = listKnownChatDevices(network)
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
          this.messages = [
            ...this.messages,
            {
              id: opened.id,
              sender: opened.sender.address,
              spaceId: opened.spaceId,
              text: opened.text,
              timestamp: opened.timestamp,
              outgoing: false
            }
          ]
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
        this.messages = [
          ...this.messages,
          {
            id: opened.id,
            sender: opened.sender.address,
            conversationAccount: opened.sender.address,
            text: opened.text,
            timestamp: opened.timestamp,
            outgoing: false
          }
        ]
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
        await this.#transport.sendSpace(envelope)
        this.messages = [
          ...this.messages,
          {
            id,
            sender: this.device.account,
            spaceId: space.spaceId,
            text: this.draft.trim(),
            timestamp: Date.now(),
            outgoing: true
          }
        ]
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
      await this.#transport.sendDirect(envelope)
      this.messages = [
        ...this.messages,
        {
          id,
          sender: this.device.account,
          conversationAccount: recipientCertificate.account,
          text: this.draft.trim(),
          timestamp: Date.now(),
          outgoing: true
        }
      ]
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
    .archive-card { margin: auto 12px 12px; display: grid; gap: 8px; font-size: 13px; }
    .archive-setting { display: flex; gap: 8px; align-items: flex-start; }
    .messages { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 12px; padding: 20px; overflow: auto; }
    .message { max-width: min(78%, 620px); align-self: flex-start; padding: 12px 14px; border-radius: 16px 16px 16px 4px; background: color-mix(in srgb, var(--md-sys-color-surface, #242126) 74%, transparent); overflow-wrap: anywhere; }
    .message.outgoing { align-self: flex-end; border-radius: 16px 16px 4px 16px; background: color-mix(in srgb, var(--md-sys-color-primary, #8dbbff) 16%, var(--md-sys-color-surface, #242126)); }
    .message-meta { display: block; margin-bottom: 4px; font-size: 11px; color: var(--md-sys-color-on-surface-variant, #c8c2cc); }
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
      main { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(170px, 34%) minmax(0, 1fr); gap: 8px; }
      aside { min-height: 0; }
      aside header { padding: 14px 16px; }
      .device-list { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
      .archive-card { margin: 8px; }
      .message { max-width: 88%; }
    }
  `

  render() {
    const conversationAccount = this.devices.find((device) => device.deviceId === this.selectedDeviceId)?.account
    const selectedSpace = this.spaces.find((space) => space.spaceId === this.selectedSpaceId)
    const conversationMessages = this.messages.filter(
      (message) =>
        this.channel === 'space'
          ? message.spaceId === this.selectedSpaceId
          : message.conversationAccount === conversationAccount
    )
    const ownPendingDevices = this.devices.filter(
      (certificate) =>
        certificate.account === this.device?.account &&
        certificate.deviceId !== this.device?.deviceId
    )
    return html`
      <main>
        <aside>
          <header>
            <p class="eyebrow">Peernet messages</p>
            <h1>Chat</h1>
            <p class="status">${this.status}</p>
          </header>
          <div class="device-list">
            <h2>Known devices</h2>
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
              : html`<p class="muted empty">No devices discovered yet. New Peernet announcements are saved for offline addressing.</p>`}
          </div>
          <section class="space-list">
            <h2>Spaces</h2>
            <button
              type="button"
              aria-current=${this.channel === 'direct' ? 'true' : 'false'}
              @click=${() => (this.channel = 'direct')}
            >
              Direct messages
            </button>
            ${this.spaces.map(
              (space) => html`
                <button
                  type="button"
                  aria-current=${this.channel === 'space' && this.selectedSpaceId === space.spaceId ? 'true' : 'false'}
                  @click=${() => {
                    this.selectedSpaceId = space.spaceId
                    this.channel = 'space'
                  }}
                >
                  # ${space.name}
                </button>
              `
            )}
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
          <section class="spaces-note">
            <h2>Spaces</h2>
            <p class="muted">
              Space invitations and messages are end-to-end encrypted. Spaces are live-only: members must be online
              together. Membership changes do not rotate the key; create a new Space if access needs to be revoked.
            </p>
          </section>
        </aside>
        <section class="conversation">
          <header>
            <p class="eyebrow">${this.channel === 'space' ? 'Space' : 'Direct message'}</p>
            <h2>${this.channel === 'space' ? selectedSpace?.name || 'Choose a Space' : conversationAccount || 'Choose a device'}</h2>
            <p class="muted">
              ${this.channel === 'space'
                ? 'End-to-end encrypted for members who received the Space invitation.'
                : 'End-to-end encrypted between approved device keys.'}
            </p>
          </header>
          ${this.error ? html`<p class="notice error" role="alert">${this.error}</p>` : ''}
          ${ownPendingDevices.length
            ? html`<p class="notice muted">Approve only devices you recognize and control.</p>`
            : ''}
          <div class="messages" aria-live="polite">
            ${conversationMessages.length
              ? conversationMessages.map(
                  (message) => html`
                    <article class=${message.outgoing ? 'message outgoing' : 'message'}>
                      <span class="message-meta">${message.outgoing ? 'You' : message.sender}</span>
                      <span>${message.text}</span>
                    </article>
                  `
                )
              : html`<p class="muted empty">
                  ${this.channel === 'space'
                    ? 'No messages in this Space yet. Send one while the other members are online.'
                    : 'Select a known device to begin a private conversation.'}
                </p>`}
          </div>
          <form @submit=${this.#send}>
            ${this.channel === 'direct'
              ? html`<select .value=${this.selectedDeviceId} @change=${this.#selectDevice} aria-label="Recipient device">
                  <option value="">Choose recipient device</option>
                  ${this.devices
                    .filter((certificate) => certificate.account !== this.device?.account)
                    .map(
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
