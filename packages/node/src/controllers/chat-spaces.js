import { encodeWire, decodeWire } from '@leofcoin/binary'
import { verifyDeviceCertificate, sealDirectMessage, createSpaceKey } from './chat-security.js'
import { loadManagedChatSpaces, saveManagedChatSpaces, managedSpacesStorageKey } from './chat-device-store.js'

const PROTOCOL = 'lfc-spaces:1'
const MAX_MEMBERS = 8 // Device certificates; bounded to fit a single encrypted control packet.
const MAX_INVITES = 20
const MAX_CHANNELS = 12
const WEEK = 7 * 86400000
const sameDevice = (a, b) => a?.account === b?.account && a?.deviceId === b?.deviceId &&
  a?.signingKey === b?.signingKey && a?.encryptionKey === b?.encryptionKey
const bytes = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0))
const base64 = value => btoa(Array.from(value, byte => String.fromCharCode(byte)).join(''))
const token = value => base64(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' && !(value instanceof Uint8Array)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value
const unsigned = ({ signature, ...document }) => document
const documentBytes = document => encodeWire('space-document', sorted(document), { maxBytes: 12000 })
const fingerprint = async key => token(new Uint8Array(await crypto.subtle.digest('SHA-256', key)))
const boundedText = (value, max = 128) => typeof value === 'string' && value.length > 0 && value.length <= max
const defaultChannel = () => ({ id: 'general', name: 'algemeen', topic: '', archived: false, version: 'initial' })
const channelName = value => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '-')
const validChannelName = name => typeof name === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,31}$/u.test(name) && name === channelName(name)

export function spaceChannels(space) {
  return space?.manifest ? space.manifest.channels || [defaultChannel()] : []
}

export function spaceRole(space, certificate) {
  if (space?.status !== 'joined') return 'none'
  const account = typeof certificate === 'string' ? certificate : certificate?.account
  if (!space.manifest?.members.some(member => typeof certificate === 'string'
    ? member.account === account : sameDevice(member, certificate))) return 'none'
  if (typeof certificate === 'string' ? account === space.manifest.ownerAccount : sameDevice(certificate, space.manifest.authority)) return 'owner'
  return space.manifest.roles?.some(role => role.account === account) ? 'moderator' : 'member'
}

function validFeatures(manifest) {
  // Signed pre-channel documents retain exactly one implicit #algemeen channel and no moderators.
  if (manifest.channels === undefined && manifest.roles === undefined) return true
  if (!Array.isArray(manifest.channels) || !manifest.channels.length || manifest.channels.length > MAX_CHANNELS ||
    !manifest.channels.some(channel => channel.id === 'general' && channel.archived === false) ||
    new Set(manifest.channels.map(channel => channel.id)).size !== manifest.channels.length ||
    new Set(manifest.channels.map(channel => channel.name)).size !== manifest.channels.length ||
    manifest.channels.some(channel => !boundedText(channel.id, 80) || !/^[A-Za-z0-9_-]+$/.test(channel.id) ||
      !validChannelName(channel.name) || typeof channel.topic !== 'string' || channel.topic.length > 120 ||
      typeof channel.archived !== 'boolean' || !boundedText(channel.version))) return false
  return Array.isArray(manifest.roles) && manifest.roles.length < manifest.members.length &&
    new Set(manifest.roles.map(role => role.account)).size === manifest.roles.length &&
    manifest.roles.every(role => role.role === 'moderator' && boundedText(role.permissionId) &&
      role.account !== manifest.ownerAccount && manifest.members.some(member => member.account === role.account))
}

function channelMutation(manifest, operation) {
  if (!operation || !['create', 'edit', 'archive', 'restore'].includes(operation.action) ||
    !boundedText(operation.channelId, 80) || !/^[A-Za-z0-9_-]+$/.test(operation.channelId) ||
    Object.keys(operation).some(key => !['action', 'channelId', 'name', 'topic', 'expectedVersion'].includes(key)))
    throw new Error('Invalid channel operation.')
  const channels = structuredClone(manifest.channels || [defaultChannel()])
  const index = channels.findIndex(channel => channel.id === operation.channelId)
  if (operation.action === 'create') {
    if (index !== -1) throw new Error('This channel already exists.')
    if (channels.length >= MAX_CHANNELS) throw new Error(`This Space supports ${MAX_CHANNELS} channels, including archived channels.`)
  } else {
    if (index === -1) throw new Error('Channel not found.')
    if (operation.expectedVersion !== channels[index].version) throw new Error('The channel changed. Refresh it before editing.')
  }
  if (['create', 'edit'].includes(operation.action)) {
    const name = channelName(operation.name), topic = operation.topic ?? ''
    if (!validChannelName(name) || typeof topic !== 'string' || topic.length > 120)
      throw new Error('Use a channel name of 1–32 letters, digits, hyphens or underscores, and a topic of at most 120 characters.')
    if (channels.some(channel => channel.id !== operation.channelId && channel.name === name)) throw new Error('A channel with this name already exists.')
    const channel = {id:operation.channelId,name,topic:topic.trim(),archived:index === -1 ? false : channels[index].archived,version:crypto.randomUUID()}
    if (index === -1) channels.push(channel); else channels[index] = channel
  } else {
    if (operation.channelId === 'general') throw new Error('The default channel cannot be archived.')
    const archived = operation.action === 'archive'
    if (channels[index].archived === archived) throw new Error(archived ? 'Channel is already archived.' : 'Channel is already active.')
    channels[index] = {...channels[index],archived,version:crypto.randomUUID()}
  }
  return channels
}

async function sign(document, device) {
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' },
    device.keys.signing.privateKey, documentBytes(document)))
  return { ...document, signature: token(signature) }
}

async function verify(document, certificate, network) {
  try {
    if (!document || typeof document.signature !== 'string' || !(await verifyDeviceCertificate(certificate, network))) return false
    const key = await crypto.subtle.importKey('raw', bytes(certificate.signingKey),
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key,
      bytes(document.signature), documentBytes(unsigned(document)))
  } catch { return false }
}

export async function verifySpaceInvitation(invite, network, { now = Date.now(), allowExpired = false } = {}) {
  if (invite?.protocol !== PROTOCOL || invite.kind !== 'invitation' || invite.network !== network ||
    !boundedText(invite.spaceId) || !boundedText(invite.name, 80) || !boundedText(invite.id) ||
    invite.ownerAccount !== invite.authority?.account || !Number.isSafeInteger(invite.createdAt) ||
    !Number.isSafeInteger(invite.expiresAt) || invite.expiresAt <= invite.createdAt ||
    invite.expiresAt - invite.createdAt > WEEK || invite.createdAt > now + 60000 ||
    (!allowExpired && invite.expiresAt <= now) ||
    Object.keys(invite).sort().join(',') !== 'authority,createdAt,expiresAt,id,kind,name,network,ownerAccount,protocol,signature,spaceId')
    throw new Error('This Space invitation is invalid, expired or belongs to another network.')
  if (!(await verify(invite, invite.authority, network))) throw new Error('The Space invitation signature is invalid.')
  return invite
}

export function encodeSpaceInvitation(invite) { return token(encodeWire('space-invitation', invite, { maxBytes: 9000 })) }

export async function parseSpaceInvitation(value, network, options) {
  if (typeof value !== 'string' || value.length > 16000) throw new Error('Paste a valid Space invitation.')
  let data = value.trim()
  if (data.includes('#')) {
    const hash = new URL(data).hash
    if (!hash.startsWith('#!/chat?')) throw new Error('This link is not a Space invitation.')
    data = new URLSearchParams(hash.slice('#!/chat?'.length)).get('invite') || ''
  }
  if (!/^[A-Za-z0-9_-]{1,12000}$/.test(data)) throw new Error('Paste a valid Space invitation.')
  return verifySpaceInvitation(decodeWire('space-invitation', bytes(data), { maxBytes: 9000 }), network, options)
}

export function spaceInvitationLink(invite, base = globalThis.location?.href) {
  const url = new URL(base)
  url.search = ''
  url.hash = `!/chat?invite=${encodeSpaceInvitation(invite)}`
  return url.href
}

async function verifyManifest(manifest, network) {
  if (manifest?.protocol !== PROTOCOL || manifest.kind !== 'membership' || manifest.network !== network ||
    !boundedText(manifest.spaceId) || !boundedText(manifest.name, 80) || !boundedText(manifest.epoch) ||
    !Number.isSafeInteger(manifest.revision) || manifest.revision < 1 ||
    !boundedText(manifest.keyHash, 64) || manifest.ownerAccount !== manifest.authority?.account ||
    !Array.isArray(manifest.members) || !manifest.members.length || manifest.members.length > MAX_MEMBERS ||
    !Array.isArray(manifest.grants) || manifest.grants.length !== manifest.members.length ||
    manifest.members.some(member => manifest.grants.filter(grant => grant.account === member.account && grant.deviceId === member.deviceId && boundedText(grant.requestId)).length !== 1) ||
    !manifest.members.some(member => sameDevice(member, manifest.authority)) ||
    new Set(manifest.members.map(member => `${member.account}:${member.deviceId}`)).size !== manifest.members.length ||
    !validFeatures(manifest) ||
    !(await verify(manifest, manifest.authority, network))) throw new Error('Invalid Space membership authority or revision.')
  for (const member of manifest.members) {
    if (!(await verifyDeviceCertificate(member, network))) throw new Error('Invalid Space member device certificate.')
  }
  return manifest
}

export function canSendToSpace(space, certificate, channelId) {
  return space?.status === 'joined' && space.keyBytes instanceof Uint8Array &&
    space.manifest.members.some(member => sameDevice(member, certificate)) &&
    (channelId === undefined || spaceChannels(space).some(channel => channel.id === channelId && !channel.archived))
}

export function canReceiveSpaceMessage(space, envelope) {
  return canSendToSpace(space, envelope?.senderCertificate, envelope?.channelId ?? 'general') && envelope.spaceId === space.spaceId &&
    envelope.spaceEpoch === space.manifest.epoch
}

// One pinned owner device signs membership. Other owner-account devices cannot silently take over.
// Membership updates rotate keys on both joins and removals. No global invite-use counter is claimed.
export class ChatSpaces {
  #device; #send; #load; #save; #locks; #tail = Promise.resolve(); #states = []; #flushing = false
  onChange = () => {}
  deliveryError = ''

  constructor({ device, send, load = () => loadManagedChatSpaces(device), save = states => saveManagedChatSpaces(device, states), locks = globalThis.navigator?.locks }) {
    this.#device = device; this.#send = send; this.#load = load; this.#save = save; this.#locks = locks
  }

  get spaces() {
    return structuredClone(this.#states.map(state => ({ ...state,
      spaceId: (state.manifest || state.invitation).spaceId,
      name: (state.manifest || state.invitation).name,
      ownerAccount: (state.manifest || state.invitation).ownerAccount })))
  }

  get queuedCount() { return this.#states.reduce((count, state) => count + (state.outbox?.length || 0), 0) }

  async #read() {
    const states = await this.#load()
    if (!Array.isArray(states) || states.length > 20) throw new Error('Invalid saved Spaces.')
    for (const state of states) {
      if (!['joined', 'offered', 'requested', 'left', 'removed', 'denied'].includes(state.status) ||
        !Array.isArray(state.outbox) || state.outbox.length > 32 || !Array.isArray(state.invites) || state.invites.length > MAX_INVITES ||
        !Array.isArray(state.requests) || state.requests.length > 20 || !Array.isArray(state.processed) || state.processed.length > 200)
        throw new Error('Invalid saved Space state.')
      if (state.channelRequests !== undefined && (!Array.isArray(state.channelRequests) || state.channelRequests.length > 12 ||
        state.channelRequests.some(request => !boundedText(request.id) || !['pending', 'applied', 'rejected'].includes(request.status))))
        throw new Error('Invalid saved channel requests.')
      if (state.status === 'joined' && (!state.manifest || !(state.keyBytes instanceof Uint8Array) || state.keyBytes.length !== 32))
        throw new Error('Joined Space is missing verified membership or its key.')
      if (state.manifest) {
        await verifyManifest(state.manifest, this.#device.network)
        if (state.status === 'joined' && (!sameDevice(state.manifest.authority, this.#device.certificate) &&
          !state.manifest.members.some(member => sameDevice(member, this.#device.certificate)))) throw new Error('This device is not a Space member.')
        if (state.keyBytes && await fingerprint(state.keyBytes) !== state.manifest.keyHash) throw new Error('Saved Space key does not match membership.')
      } else await verifySpaceInvitation(state.invitation, this.#device.network, { allowExpired: true })
    }
    return states
  }

  #mutate(action, persist = true) {
    const work = async () => {
      const states = await this.#read()
      const result = await action(states)
      if (persist) await this.#save(states)
      this.#states = states
      this.onChange()
      return result
    }
    const next = this.#tail.then(() => this.#locks
      ? this.#locks.request(managedSpacesStorageKey(this.#device), work) : work())
    this.#tail = next.catch(() => {})
    return next
  }

  async refresh() {
    await this.#mutate(() => {}, false)
  }

  async flush() {
    if (this.#flushing) return
    this.#flushing = true
    try {
      for (const envelope of this.#states.flatMap(state => state.outbox)) {
        try {
          await this.#send(envelope)
          await this.#mutate(states => { for (const state of states) state.outbox = state.outbox.filter(item => item.id !== envelope.id) })
          this.deliveryError = ''
        } catch (error) { this.deliveryError = String(error.message || error); break }
      }
    } finally { this.#flushing = false; this.onChange() }
  }

  #get(states, spaceId) {
    const state = states.find(item => (item.manifest || item.invitation).spaceId === spaceId)
    if (!state) throw new Error('Space not found.')
    return state
  }

  #owner(state) {
    if (!sameDevice(state.manifest?.authority, this.#device.certificate))
      throw new Error('Only the original Space owner device can manage membership and invitations.')
  }

  async #queue(state, recipient, content) {
    if (state.outbox.length >= 32) throw new Error('Space delivery queue is full. Wait for it to drain.')
    state.outbox.push(await sealDirectMessage({ id: crypto.randomUUID(), control: { protocol: PROTOCOL, ...content },
      sender: { account: this.#device.account, deviceId: this.#device.deviceId },
      senderCertificate: this.#device.certificate, senderSigningKey: this.#device.keys.signing.privateKey,
      recipient: { account: recipient.account, deviceId: recipient.deviceId, network: this.#device.network },
      recipientCertificate: recipient, recipientEncryptionKey: bytes(recipient.encryptionKey) }))
  }

  async #membership(state, members, grants = state.manifest.grants) {
    const old = state.manifest
    const keyBytes = createSpaceKey()
    state.manifest = await sign({ protocol: PROTOCOL, kind: 'membership', spaceId: old.spaceId, name: old.name,
      network: old.network, ownerAccount: old.ownerAccount, authority: old.authority, revision: old.revision + 1,
      epoch: crypto.randomUUID(), keyHash: await fingerprint(keyBytes), members,
      channels: old.channels || [defaultChannel()], roles: (old.roles || []).filter(role => members.some(member => member.account === role.account)),
      grants: grants.filter(grant => members.some(member => member.account === grant.account && member.deviceId === grant.deviceId)) }, this.#device)
    state.keyBytes = keyBytes
  }

  async #configure(state, changes) {
    if (!Number.isSafeInteger(state.manifest.revision + 1)) throw new Error('Space revision limit reached.')
    state.manifest = await sign({...unsigned(state.manifest),channels:state.manifest.channels || [defaultChannel()],
      roles:state.manifest.roles || [],...changes,revision:state.manifest.revision + 1}, this.#device)
  }

  async #broadcast(state, commandId = '', requester) {
    for (const member of state.manifest.members.filter(member => !sameDevice(member, this.#device.certificate)))
      await this.#queue(state, member, {kind:'membership',manifest:state.manifest,keyBytes:state.keyBytes,requestId:'',
        ...(commandId && sameDevice(member, requester) ? {commandId} : {})})
  }

  async setModerator(spaceId, account, enabled) {
    if (typeof enabled !== 'boolean') throw new Error('Choose a valid moderator role.')
    await this.#mutate(async states => {
      const state = this.#get(states, spaceId); this.#owner(state)
      if (account === state.manifest.ownerAccount || !state.manifest.members.some(member => member.account === account))
        throw new Error('Only a current non-owner member can be assigned a moderator role.')
      const roles = (state.manifest.roles || []).filter(role => role.account !== account)
      if (enabled) roles.push({account,role:'moderator',permissionId:crypto.randomUUID()})
      await this.#configure(state, {roles})
      await this.#broadcast(state)
    })
    await this.flush()
  }

  async changeChannel(spaceId, operation) {
    const result = await this.#mutate(async states => {
      const state = this.#get(states, spaceId), role = spaceRole(state, this.#device.certificate)
      if (!['owner', 'moderator'].includes(role)) throw new Error('Only the owner or a moderator can manage channels.')
      const op = {...operation}
      if (op.action === 'create') op.channelId ||= crypto.randomUUID()
      else op.expectedVersion ??= spaceChannels(state).find(channel => channel.id === op.channelId)?.version
      const channels = channelMutation(state.manifest, op)
      if (role === 'owner') {
        await this.#configure(state, {channels}); await this.#broadcast(state); return {channelId:op.channelId,commandId:''}
      }
      const requests = state.channelRequests || []
      if (requests.filter(request => request.status === 'pending').length >= 12) throw new Error('Wait for pending channel changes before sending more.')
      const id = crypto.randomUUID()
      const pending = requests.filter(request => request.status === 'pending'), slots = 11 - pending.length
      state.channelRequests = [...pending, ...(slots ? requests.filter(request => request.status !== 'pending').slice(-slots) : []),
        {id,operation:op,status:'pending',error:''}]
      await this.#queue(state, state.manifest.authority, {kind:'channel-command',spaceId,id,operation:op,
        permissionId:state.manifest.roles.find(item => item.account === this.#device.account).permissionId})
      return {channelId:op.channelId,commandId:id}
    })
    await this.flush()
    return result
  }

  #channelResult(state, commandId, status, error = '') {
    const request = state.channelRequests?.find(item => item.id === commandId)
    if (request?.status === 'pending') { request.status = status; request.error = error }
  }

  async #receiveChannelCommand(state, control, sender) {
    this.#owner(state)
    if (!boundedText(control.id) || !state.manifest.members.some(member => sameDevice(member, sender)))
      throw new Error('Channel commands require a current member device.')
    if (state.processed.includes(`channel-applied:${control.id}`)) {
      await this.#queue(state, sender, {kind:'membership',manifest:state.manifest,keyBytes:state.keyBytes,requestId:'',commandId:control.id}); return
    }
    const role = state.manifest.roles?.find(item => item.account === sender.account)
    let channels, error = ''
    try {
      if (!role || role.permissionId !== control.permissionId || state.processed.includes(`channel-rejected:${control.id}`))
        throw new Error('Moderator permission is no longer current.')
      channels = channelMutation(state.manifest, control.operation)
    } catch (failure) { error = String(failure.message || failure).slice(0, 160) }
    if (error) {
      await this.#queue(state, sender, {kind:'channel-result',spaceId:state.manifest.spaceId,commandId:control.id,status:'rejected',error})
      state.processed = [...state.processed,`channel-rejected:${control.id}`].slice(-200); return
    }
    await this.#configure(state, {channels})
    await this.#broadcast(state, control.id, sender)
    state.processed = [...state.processed,`channel-applied:${control.id}`].slice(-200)
  }

  async create(name, existingSpaceId) {
    name = String(name).trim()
    if (!boundedText(name, 80)) throw new Error('Use a Space name of 1–80 characters.')
    const id = await this.#mutate(async states => {
      if (states.length >= 20) throw new Error('At most 20 managed Spaces are supported.')
      const spaceId = existingSpaceId || crypto.randomUUID(), keyBytes = createSpaceKey()
      if (!boundedText(spaceId) || states.some(state => (state.manifest || state.invitation).spaceId === spaceId))
        throw new Error('This Space is already managed.')
      const manifest = await sign({ protocol: PROTOCOL, kind: 'membership', spaceId, name,
        network: this.#device.network, ownerAccount: this.#device.account, authority: this.#device.certificate,
        revision: 1, epoch: crypto.randomUUID(), keyHash: await fingerprint(keyBytes), members: [this.#device.certificate],
        channels:[defaultChannel()],roles:[],
        grants: [{account:this.#device.account,deviceId:this.#device.deviceId,requestId:'owner'}] }, this.#device)
      states.push({ manifest, keyBytes, status: 'joined', invites: [], requests: [], processed: [], outbox: [] })
      return spaceId
    })
    return id
  }

  async createInvitation(spaceId, lifetime = 86400000) {
    if (!Number.isSafeInteger(lifetime) || lifetime < 60000 || lifetime > WEEK) throw new Error('Invite expiry must be between one minute and seven days.')
    return this.#mutate(async states => {
      const state = this.#get(states, spaceId); this.#owner(state)
      state.invites = state.invites.filter(item => item.expiresAt > Date.now())
      if (state.invites.length >= MAX_INVITES) throw new Error('Revoke an invitation before creating another.')
      const createdAt = Date.now()
      const invite = await sign({ protocol: PROTOCOL, kind: 'invitation', id: crypto.randomUUID(),
        spaceId, name: state.manifest.name, network: this.#device.network, ownerAccount: this.#device.account,
        authority: this.#device.certificate, createdAt, expiresAt: createdAt + lifetime }, this.#device)
      state.invites.push(invite)
      return invite
    })
  }

  async revokeInvitation(spaceId, inviteId) {
    await this.#mutate(states => { const state = this.#get(states, spaceId); this.#owner(state)
      state.invites = state.invites.filter(invite => invite.id !== inviteId)
      state.requests = state.requests.filter(request => request.inviteId !== inviteId)
    })
  }

  async offer(invite, recipient) {
    await verifySpaceInvitation(invite, this.#device.network)
    await this.#mutate(async states => { const state = this.#get(states, invite.spaceId); this.#owner(state)
      if (!state.invites.some(item => item.signature === invite.signature)) throw new Error('Invitation is no longer active.')
      await this.#queue(state, recipient, { kind: 'offer', invitation: invite })
    })
    await this.flush()
  }

  async requestJoin(value) {
    const invite = typeof value === 'string' ? await parseSpaceInvitation(value, this.#device.network)
      : await verifySpaceInvitation(value, this.#device.network)
    if (invite.ownerAccount === this.#device.account) throw new Error('Use the original owner device for this Space.')
    await this.#mutate(async states => {
      let state = states.find(item => (item.manifest || item.invitation).spaceId === invite.spaceId)
      if (state?.status === 'joined') throw new Error('You already belong to this Space.')
      if (state?.status === 'requested') throw new Error('Your request is already pending. Wait for the owner or cancel it first.')
      if (!state) {
        if (states.length >= 20) throw new Error('At most 20 managed Spaces are supported.')
        state = { manifest: null, invites: [], requests: [], processed: [], outbox: [] }; states.push(state)
      }
      if (state.manifest && (!sameDevice(state.manifest.authority, invite.authority) || state.manifest.ownerAccount !== invite.ownerAccount))
        throw new Error('The invitation changes the existing Space authority.')
      state.invitation = invite; state.status = 'requested'; state.keyBytes = null; state.requestId = crypto.randomUUID()
      await this.#queue(state, invite.authority, { kind: 'join', requestId: state.requestId, invitation: invite })
    })
    await this.flush()
  }

  async approve(spaceId, requestId) {
    await this.#mutate(async states => {
      const state = this.#get(states, spaceId); this.#owner(state)
      const request = state.requests.find(item => item.requestId === requestId)
      const invite = state.invites.find(item => item.id === request?.inviteId)
      if (!request || !invite || invite.expiresAt <= Date.now()) throw new Error('This request has expired or its invitation was revoked.')
      const oldMembers = state.manifest.members
      const exists = oldMembers.some(member => sameDevice(member, request.certificate))
      if (!exists && oldMembers.length >= MAX_MEMBERS) throw new Error(`This Space supports ${MAX_MEMBERS} member devices.`)
      const grants = state.manifest.grants.filter(grant => grant.account !== request.certificate.account || grant.deviceId !== request.certificate.deviceId)
      grants.push({account:request.certificate.account,deviceId:request.certificate.deviceId,requestId})
      await this.#membership(state, exists ? oldMembers : [...oldMembers, request.certificate], grants)
      for (const member of state.manifest.members.filter(member => !sameDevice(member, this.#device.certificate))) {
        await this.#queue(state, member, { kind: 'membership', manifest: state.manifest, keyBytes: state.keyBytes,
          requestId: sameDevice(member, request.certificate) ? requestId : '' })
      }
      state.requests = state.requests.filter(item => item.requestId !== requestId)
      state.processed = [...state.processed, requestId].slice(-200)
    })
    await this.flush()
  }

  async deny(spaceId, requestId) {
    await this.#mutate(async states => {
      const state = this.#get(states, spaceId); this.#owner(state)
      const request = state.requests.find(item => item.requestId === requestId)
      if (!request) throw new Error('Join request not found.')
      await this.#queue(state, request.certificate, { kind: 'denied', spaceId, requestId })
      state.requests = state.requests.filter(item => item.requestId !== requestId)
      state.processed = [...state.processed, requestId].slice(-200)
    })
    await this.flush()
  }

  async #remove(state, account) {
    if (account === state.manifest.ownerAccount) throw new Error('The owner cannot leave or be removed.')
    const removed = state.manifest.members.filter(member => member.account === account)
    if (!removed.length) throw new Error('Member not found.')
    await this.#membership(state, state.manifest.members.filter(member => member.account !== account))
    // Removed members may know invite links: revoke every existing link and pending request.
    state.invites = []; state.requests = []
    for (const member of [...state.manifest.members, ...removed].filter(member => !sameDevice(member, this.#device.certificate)))
      await this.#queue(state, member, { kind: 'membership', manifest: state.manifest,
        keyBytes: member.account === account ? null : state.keyBytes, requestId: '' })
  }

  async remove(spaceId, account) {
    await this.#mutate(async states => { const state = this.#get(states, spaceId); this.#owner(state); await this.#remove(state, account) })
    await this.flush()
  }

  async leave(spaceId) {
    await this.#mutate(async states => {
      const state = this.#get(states, spaceId)
      if (state.manifest?.ownerAccount === this.#device.account) throw new Error('The owner cannot leave their Space.')
      if (state.manifest && state.status === 'joined') await this.#queue(state, state.manifest.authority, { kind: 'leave', spaceId,
        grantId: state.manifest.grants.find(grant => grant.account === this.#device.account && grant.deviceId === this.#device.deviceId)?.requestId })
      state.keyBytes = null; state.status = 'left'; state.requestId = ''
    })
    await this.flush()
  }

  async forget(spaceId) {
    await this.#mutate(states => {
      const state = this.#get(states, spaceId)
      if (state.status === 'joined' || state.outbox.length) throw new Error('Leave the Space and send queued updates before forgetting it.')
      states.splice(states.indexOf(state), 1)
    })
  }

  async receive(control, sender) {
    if (control?.protocol !== PROTOCOL || !(await verifyDeviceCertificate(sender, this.#device.network)))
      throw new Error('Invalid Space control sender.')
    await this.#mutate(async states => {
      if (control.kind === 'offer') {
        const invite = await verifySpaceInvitation(control.invitation, this.#device.network)
        if (!sameDevice(sender, invite.authority)) throw new Error('Only the Space owner can send this offer.')
        const existing = states.find(state => (state.manifest || state.invitation).spaceId === invite.spaceId)
        if (existing) {
          if (!sameDevice((existing.manifest || existing.invitation).authority, invite.authority)) throw new Error('The Space owner identity changed.')
          if (!['joined', 'requested'].includes(existing.status)) { existing.invitation = invite; existing.status = 'offered' }
          return
        }
        if (states.length >= 20) throw new Error('Space invitation inbox is full.')
        states.push({ manifest: null, invitation: invite, status: 'offered', invites: [], requests: [], processed: [], outbox: [] })
        return
      }
      if (control.kind === 'join') {
        const invite = await verifySpaceInvitation(control.invitation, this.#device.network)
        const state = this.#get(states, invite.spaceId); this.#owner(state)
        if (!boundedText(control.requestId) || !state.invites.some(item => item.id === invite.id && item.signature === invite.signature))
          throw new Error('This invitation has been revoked or is unknown.')
        if (state.processed.includes(control.requestId) || state.requests.some(item => item.requestId === control.requestId)) return
        if (state.requests.length >= 20) throw new Error('Space join-request inbox is full.')
        state.requests.push({ requestId: control.requestId, inviteId: invite.id, certificate: sender })
        return
      }
      if (control.kind === 'membership') {
        const manifest = await verifyManifest(control.manifest, this.#device.network)
        const state = this.#get(states, manifest.spaceId)
        const authority = (state.manifest || state.invitation).authority
        if (!sameDevice(sender, authority) || !sameDevice(manifest.authority, authority)) throw new Error('The Space owner identity changed.')
        const member = manifest.members.some(item => sameDevice(item, this.#device.certificate))
        const grant = manifest.grants.find(item => item.account === this.#device.account && item.deviceId === this.#device.deviceId)
        const joining = state.status === 'requested' && grant?.requestId === state.requestId
        const revokedWhileWaiting = state.status === 'requested' && !member
        if (state.status !== 'joined' && !joining && !revokedWhileWaiting) return // An offer or cancelled request is never consent.
        if (boundedText(control.commandId)) this.#channelResult(state, control.commandId, 'applied')
        if (manifest.revision < (state.manifest?.revision || 0)) return // Normal network reordering must not roll state back.
        if (manifest.revision === state.manifest?.revision) {
          if (manifest.signature !== state.manifest.signature) throw new Error('Conflicting Space membership revision.')
          return
        }
        if (member && (!(control.keyBytes instanceof Uint8Array) || control.keyBytes.length !== 32 ||
          await fingerprint(control.keyBytes) !== manifest.keyHash)) throw new Error('Space key does not match signed membership.')
        state.manifest = manifest; state.keyBytes = member ? control.keyBytes : null
        state.status = member ? 'joined' : 'removed'; state.requestId = ''
        if (!member) for (const request of state.channelRequests || []) this.#channelResult(state, request.id, 'rejected', 'Your Space membership was removed.')
        return
      }
      const state = this.#get(states, control.spaceId)
      if (control.kind === 'channel-command') { await this.#receiveChannelCommand(state, control, sender); return }
      if (control.kind === 'channel-result') {
        if (!sameDevice(sender, state.manifest?.authority) || control.status !== 'rejected' || !boundedText(control.error, 160))
          throw new Error('Invalid channel command response.')
        this.#channelResult(state, control.commandId, 'rejected', control.error); return
      }
      if (control.kind === 'denied') {
        if (!sameDevice(sender, (state.manifest || state.invitation).authority) || state.status !== 'requested' || control.requestId !== state.requestId)
          throw new Error('Invalid Space request response.')
        state.status = 'denied'; state.requestId = ''; return
      }
      if (control.kind === 'leave') {
        this.#owner(state)
        if (!state.manifest.members.some(member => sameDevice(member, sender))) return
        if (!state.manifest.grants.some(grant => grant.account === sender.account && grant.deviceId === sender.deviceId && grant.requestId === control.grantId)) return
        await this.#remove(state, sender.account); return
      }
      throw new Error('Unsupported Space control message.')
    })
    await this.flush()
  }
}
