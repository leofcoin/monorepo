import assert from 'node:assert/strict'
import test from 'node:test'
import generateAccount from '@leofcoin/generate-account'
import IdentityController from '../src/controllers/identity.ts'
import { encodeWire, decodeWire } from '@leofcoin/binary'
import { ChatSpaces, parseSpaceInvitation, spaceInvitationLink, canReceiveSpaceMessage, canSendToSpace, spaceChannels, spaceRole } from '../src/controllers/chat-spaces.js'
import { createDeviceKeys, createDeviceCertificate, openDirectMessage, sealSpaceMessage, openSpaceMessage } from '../src/controllers/chat-security.js'
import { loadManagedChatSpaces, saveManagedChatSpaces } from '../src/controllers/chat-device-store.js'
import { createChatTransport } from '../src/controllers/chat-transport.js'

const network = 'leofcoin:peach'
class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, value) }
  removeItem(key) { this.values.delete(key) }
}

async function participant() {
  const password = 'spaces-isolated-test-only'
  const wallet = await generateAccount(password, network)
  globalThis.walletStore = { get: async () => new TextEncoder().encode(JSON.stringify(wallet.accounts)) }
  const identity = new IdentityController(network, wallet)
  await identity.unlock(password)
  const account = wallet.accounts[0][1], keys = await createDeviceKeys(), deviceId = crypto.randomUUID()
  const signer = await identity.signer(account)
  const certificate = await createDeviceCertificate({ account, network, deviceId, peerId: `test-${deviceId}`, keys, signWithAccount: signer.sign })
  const device = { account, network, deviceId, certificate, keys }
  const storage = new MemoryStorage(), outgoing = []
  const options = { device, send: async envelope => { outgoing.push(encodeWire('test-space-envelope', envelope)) },
    load: () => loadManagedChatSpaces(device, storage), save: states => saveManagedChatSpaces(device, states, storage) }
  const manager = new ChatSpaces(options)
  await manager.refresh()
  return { device, storage, outgoing, options, manager }
}

async function deliver(from, to) {
  for (const packet of from.outgoing.splice(0)) {
    const envelope = decodeWire('test-space-envelope', packet)
    if (envelope.recipientDeviceId !== to.device.deviceId) { from.outgoing.push(packet); continue }
    assert.ok(packet instanceof Uint8Array)
    const opened = await openDirectMessage({ envelope, recipientAccount: to.device.account,
      recipientDeviceId: to.device.deviceId, recipientPrivateKey: to.device.keys.encryption.privateKey,
      network, trustedCertificates: [from.device.certificate] })
    assert.equal(opened.text, '')
    await to.manager.receive(opened.control, envelope.senderCertificate)
  }
}

async function join(owner, member, id, invite) {
  await member.manager.requestJoin(invite)
  await deliver(member, owner)
  const request = owner.manager.spaces.find(space => space.spaceId === id).requests.at(-1)
  await owner.manager.approve(id, request.requestId)
  await deliver(owner, member)
}

test('Space links are signed, network-bound, expiring, key-free and inert until explicit request and approval', async () => {
  const owner = await participant(), bob = await participant()
  const id = await owner.manager.create('Private friends')
  const invite = await owner.manager.createInvitation(id)
  const link = spaceInvitationLink(invite, 'https://node.example/monorepo/?tracking=remove')
  assert.equal(new URL(link).search, '')
  const preview = await parseSpaceInvitation(link, network)
  assert.equal(preview.name, 'Private friends')
  assert.equal(bob.manager.spaces.length, 0, 'parsing the preview neither joins nor sends anything')
  assert.equal(bob.outgoing.length, 0)
  assert.equal(Object.hasOwn(preview, 'key'), false)
  assert.equal(Object.hasOwn(preview, 'keyBytes'), false)
  const raw = new TextDecoder().decode(encodeWire('test-space-invitation', preview))
  assert.equal(raw.includes(btoa(String.fromCharCode(...owner.manager.spaces[0].keyBytes))), false)
  await assert.rejects(parseSpaceInvitation(link, 'leofcoin:mainnet'), /network/)
  await assert.rejects(parseSpaceInvitation(link, network, {now:invite.expiresAt}), /expired/)
  const forged = { ...invite, name: 'Forged name' }
  await assert.rejects(bob.manager.requestJoin(forged), /signature/)
  await owner.manager.offer(invite, bob.device.certificate)
  await deliver(owner, bob)
  assert.equal(bob.manager.spaces[0].status, 'offered')
  assert.equal(bob.manager.spaces[0].keyBytes, undefined)
  await bob.manager.requestJoin(preview)
  assert.equal(bob.manager.spaces[0].status, 'requested')
  assert.equal(bob.manager.spaces[0].keyBytes, null)
  await deliver(bob, owner)
  assert.equal(owner.manager.spaces[0].requests.length, 1)
  await owner.manager.approve(id, owner.manager.spaces[0].requests[0].requestId)
  const wire = owner.outgoing[0]
  assert.equal(new TextDecoder().decode(wire).includes('Private friends'), false, 'membership and keys are encrypted in transit')
  await deliver(owner, bob)
  assert.equal(bob.manager.spaces[0].status, 'joined')
  assert.deepEqual(bob.manager.spaces[0].keyBytes, owner.manager.spaces[0].keyBytes)
  assert.equal(canSendToSpace(bob.manager.spaces[0], bob.device.certificate), true)
  const serialized = JSON.stringify([...bob.storage.values])
  assert.equal(serialized.includes('Private friends'), false)
  assert.equal(serialized.includes(invite.signature), false)
  const restarted = new ChatSpaces(bob.options)
  await restarted.refresh()
  assert.deepEqual(restarted.spaces, bob.manager.spaces)
})

test('revoked links, cancelled requests, denial, forged authority and stale updates cannot grant membership', async () => {
  const owner = await participant(), bob = await participant(), attacker = await participant()
  const id = await owner.manager.create('Access checks')
  let invite = await owner.manager.createInvitation(id)
  await bob.manager.requestJoin(invite)
  const requestPacket = bob.outgoing[0]
  await owner.manager.revokeInvitation(id, invite.id)
  await assert.rejects(deliver(bob, owner), /revoked/)
  assert.equal(owner.manager.spaces[0].manifest.members.length, 1)
  await bob.manager.leave(id)
  invite = await owner.manager.createInvitation(id)
  await bob.manager.requestJoin(invite)
  await deliver(bob, owner)
  await owner.manager.deny(id, owner.manager.spaces[0].requests[0].requestId)
  await deliver(owner, bob)
  assert.equal(bob.manager.spaces[0].status, 'denied')
  await bob.manager.requestJoin(invite)
  await deliver(bob, owner)
  const requestId = owner.manager.spaces[0].requests[0].requestId
  await owner.manager.approve(id, requestId)
  const grant = decodeWire('test-space-envelope', owner.outgoing[0])
  const opened = await openDirectMessage({envelope:grant,recipientAccount:bob.device.account,recipientDeviceId:bob.device.deviceId,
    recipientPrivateKey:bob.device.keys.encryption.privateKey,network,trustedCertificates:[owner.device.certificate]})
  await assert.rejects(bob.manager.receive(opened.control, attacker.device.certificate), /identity changed/)
  await bob.manager.leave(id)
  await deliver(owner, bob)
  assert.equal(bob.manager.spaces[0].status, 'left', 'an in-flight grant cannot undo cancellation')
  assert.equal(bob.manager.spaces[0].keyBytes, null)
  await assert.rejects(bob.manager.receive({protocol:'lfc-spaces:1',kind:'join',requestId:'replay',invitation:invite}, attacker.device.certificate), /original Space owner/)
  assert.ok(requestPacket.byteLength > 0)
})

test('member removal rotates keys, revokes links and excludes old epochs and removed device signatures', async () => {
  const owner = await participant(), bob = await participant()
  const id = await owner.manager.create('Rotation')
  const invite = await owner.manager.createInvitation(id)
  await join(owner, bob, id, invite)
  const old = bob.manager.spaces[0]
  const oldMessage = await sealSpaceMessage({id:crypto.randomUUID(),spaceId:id,spaceEpoch:old.manifest.epoch,text:'Old epoch',
    sender:{account:bob.device.account,deviceId:bob.device.deviceId},certificate:bob.device.certificate,
    signingKey:bob.device.keys.signing.privateKey,spaceKey:old.keyBytes})
  assert.equal(canReceiveSpaceMessage(owner.manager.spaces[0], oldMessage), true)
  await assert.rejects(bob.manager.remove(id, owner.device.account), /original Space owner/)
  await assert.rejects(owner.manager.remove(id, owner.device.account), /cannot leave/)
  await owner.manager.remove(id, bob.device.account)
  assert.notDeepEqual(owner.manager.spaces[0].keyBytes, old.keyBytes)
  assert.equal(owner.manager.spaces[0].invites.length, 0)
  assert.equal(canReceiveSpaceMessage(owner.manager.spaces[0], oldMessage), false)
  await deliver(owner, bob)
  assert.equal(bob.manager.spaces[0].status, 'removed')
  assert.equal(bob.manager.spaces[0].keyBytes, null)
  const current = owner.manager.spaces[0]
  const next = await sealSpaceMessage({id:crypto.randomUUID(),spaceId:id,spaceEpoch:current.manifest.epoch,text:'Future message',
    sender:{account:owner.device.account,deviceId:owner.device.deviceId},certificate:owner.device.certificate,
    signingKey:owner.device.keys.signing.privateKey,spaceKey:current.keyBytes})
  await assert.rejects(openSpaceMessage({envelope:next,spaceId:id,spaceKey:old.keyBytes,network,trustedCertificates:[owner.device.certificate]}))
  await assert.rejects(bob.manager.requestJoin(invite).then(() => deliver(bob, owner)), /revoked/)
})

test('Space control outbox survives publish failure, restart and replay without duplicate membership', async () => {
  const owner = await participant(), bob = await participant()
  const id = await owner.manager.create('Recovery'), invite = await owner.manager.createInvitation(id)
  await bob.manager.requestJoin(invite); await deliver(bob, owner)
  const requestId = owner.manager.spaces[0].requests[0].requestId
  const failing = new ChatSpaces({...owner.options,send:async()=>{throw new Error('offline')}})
  await failing.refresh(); await failing.approve(id, requestId)
  assert.equal(failing.queuedCount, 1)
  assert.match(failing.deliveryError, /offline/)
  const restarted = new ChatSpaces(owner.options); await restarted.refresh(); await restarted.flush()
  const packet = owner.outgoing[0]
  await deliver(owner, bob)
  owner.outgoing.push(packet); await deliver(owner, bob)
  assert.equal(bob.manager.spaces[0].manifest.members.length, 2)
  assert.equal(restarted.queuedCount, 0)
  const stale = failing.spaces[0]
  await assert.rejects(restarted.receive({protocol:'lfc-spaces:1',kind:'membership',manifest:{...stale.manifest,revision:0},keyBytes:stale.keyBytes},owner.device.certificate), /Invalid/)
})

test('actual chat transport carries encrypted binary join, approval and removal between two simulated peers', async t => {
  const owner = await participant(), bob = await participant()
  const handlers = new Map(), packets = [], errors = []
  function peer(id) { return {id,subscribe:async(topic,fn)=>{handlers.set(id,fn);return()=>handlers.delete(id)},
    publish:async(topic,packet)=>{assert.ok(packet instanceof Uint8Array);packets.push(packet)
      for(const [other,fn] of handlers) if(other!==id) queueMicrotask(()=>fn(packet))}} }
  for (const [index, participant] of [owner,bob].entries()) {
    const device = participant.device
    const transport = createChatTransport({peernet:peer(`spaces-test-${index}`),network,storage:new MemoryStorage(),
      identityProvider:async()=>({...device,signingKey:device.keys.signing.privateKey})})
    t.after(()=>transport.stop())
    participant.manager = new ChatSpaces({...participant.options,send:envelope=>transport.hasPendingMessage(envelope.id) ? undefined : transport.sendDirect(envelope)})
    transport.subscribe(async event=>{
      if(event.type!=='direct'||event.envelope.recipientDeviceId!==device.deviceId)return
      try {
        const opened = await openDirectMessage({envelope:event.envelope,recipientAccount:device.account,recipientDeviceId:device.deviceId,
          recipientPrivateKey:device.keys.encryption.privateKey,network,trustedCertificates:[event.envelope.senderCertificate]})
        await participant.manager.receive(opened.control,event.envelope.senderCertificate)
      } catch(error){errors.push(error)}
    })
    await participant.manager.refresh(); await transport.start()
  }
  async function until(check) {for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,10))}assert.fail('Space flow timed out')}
  const id = await owner.manager.create('Binary transport Space'), invite = await owner.manager.createInvitation(id)
  await bob.manager.requestJoin(spaceInvitationLink(invite,'https://node.example'))
  await until(()=>owner.manager.spaces[0].requests.length===1)
  await owner.manager.approve(id,owner.manager.spaces[0].requests[0].requestId)
  await until(()=>bob.manager.spaces[0].status==='joined')
  await owner.manager.remove(id,bob.device.account)
  await until(()=>bob.manager.spaces[0].status==='removed')
  assert.deepEqual(errors,[])
  assert.ok(packets.length>0)
  assert.ok(packets.every(packet=>!new TextDecoder().decode(packet).includes('Binary transport Space')))
})

test('out-of-order grants/removals cannot revive access, and later snapshots retain the explicit join nonce', async () => {
  const owner = await participant(), bob = await participant(), charlie = await participant()
  const id = await owner.manager.create('Out of order'), invite = await owner.manager.createInvitation(id)
  await bob.manager.requestJoin(invite); await deliver(bob, owner)
  await owner.manager.approve(id, owner.manager.spaces[0].requests[0].requestId)
  const firstGrant = owner.outgoing.splice(0)
  await charlie.manager.requestJoin(invite); await deliver(charlie, owner)
  await owner.manager.approve(id, owner.manager.spaces[0].requests[0].requestId)
  await deliver(owner, bob)
  assert.equal(bob.manager.spaces[0].status, 'joined', 'a later snapshot contains the original signed admission nonce')
  assert.equal(bob.manager.spaces[0].manifest.revision, 3)
  owner.outgoing.push(...firstGrant); await deliver(owner, bob)
  assert.equal(bob.manager.spaces[0].manifest.revision, 3, 'late older updates are ignored')
  await deliver(owner, charlie)
  await charlie.manager.leave(id)
  await deliver(charlie, owner)
  await deliver(owner, bob); await deliver(owner, charlie)
  assert.equal(charlie.manager.spaces[0].status, 'left')

  const other = await participant(), nextInvite = await owner.manager.createInvitation(id)
  await other.manager.requestJoin(nextInvite); await deliver(other, owner)
  await owner.manager.approve(id, owner.manager.spaces[0].requests[0].requestId)
  const pendingGrants = owner.outgoing.splice(0)
  await owner.manager.remove(id, other.device.account)
  await deliver(owner, other)
  assert.equal(other.manager.spaces[0].status, 'removed', 'removal is authoritative even before initial grant arrives')
  owner.outgoing.push(...pendingGrants); await deliver(owner, other)
  assert.equal(other.manager.spaces[0].status, 'removed')
  assert.equal(other.manager.spaces[0].keyBytes, null)
})

test('a delayed leave cannot remove a newly approved membership, and the maximum roster fits chat packet bounds', async () => {
  const owner = await participant(), bob = await participant()
  const id = await owner.manager.create('Bounded roster'), invite = await owner.manager.createInvitation(id)
  await join(owner, bob, id, invite)
  await bob.manager.leave(id)
  const oldLeave = bob.outgoing.splice(0)
  await bob.manager.requestJoin(invite); await deliver(bob, owner)
  await owner.manager.approve(id, owner.manager.spaces[0].requests[0].requestId)
  bob.outgoing.push(...oldLeave); await deliver(bob, owner)
  assert.equal(owner.manager.spaces[0].manifest.members.length, 2)
  await deliver(owner, bob)
  assert.equal(bob.manager.spaces[0].status, 'joined')
  for (let index = 0; index < 6; index++) {
    const member = await participant()
    await member.manager.requestJoin(invite); await deliver(member, owner)
    await owner.manager.approve(id, owner.manager.spaces[0].requests[0].requestId)
    assert.ok(owner.outgoing.every(packet => packet.byteLength < 30000), 'bounded roster fits encrypted chat envelopes')
    owner.outgoing.length = 0
  }
  assert.equal(owner.manager.spaces[0].manifest.members.length, 8)
  for (const member of owner.manager.spaces[0].manifest.members.filter(member => member.account !== owner.device.account))
    await owner.manager.setModerator(id, member.account, true)
  for (let index = 0; index < 11; index++) {
    await owner.manager.changeChannel(id, {action:'create',name:`channel-${index}`.padEnd(32,'x'),topic:'T'.repeat(120)})
    assert.ok(owner.outgoing.every(packet => packet.byteLength < 30000), 'maximum roster, roles and channels fit encrypted packet bounds')
    owner.outgoing.length = 0
  }
  await assert.rejects(owner.manager.changeChannel(id, {action:'create',name:'excess'}), /12 channels/)
  const excess = await participant()
  await excess.manager.requestJoin(invite); await deliver(excess, owner)
  await assert.rejects(owner.manager.approve(id, owner.manager.spaces[0].requests[0].requestId), /8 member devices/)
  assert.equal(owner.manager.spaces[0].manifest.members.length, 8)
})

test('channels are signed, isolated by ID, archived without deleting history, and limited to owner/moderator management', async () => {
  const owner = await participant(), moderator = await participant()
  const id = await owner.manager.create('Channels'), invite = await owner.manager.createInvitation(id)
  await join(owner, moderator, id, invite)
  assert.equal(spaceRole(moderator.manager.spaces[0], moderator.device.certificate), 'member')
  await assert.rejects(moderator.manager.changeChannel(id,{action:'create',name:'unauthorized'}), /owner or a moderator/)
  await assert.rejects(moderator.manager.setModerator(id,moderator.device.account,true), /original Space owner/)
  await assert.rejects(owner.manager.setModerator(id,owner.device.account,true), /non-owner/)
  await owner.manager.setModerator(id,moderator.device.account,true); await deliver(owner, moderator)
  assert.equal(spaceRole(moderator.manager.spaces[0],moderator.device.certificate),'moderator')
  await assert.rejects(moderator.manager.remove(id,owner.device.account), /original Space owner/)
  const before = owner.manager.spaces[0]
  const change = await moderator.manager.changeChannel(id,{action:'create',name:'Development',topic:'Build together'})
  assert.equal(spaceChannels(moderator.manager.spaces[0]).length,1, 'channel is not optimistic before owner authorization')
  assert.equal(moderator.manager.spaces[0].channelRequests[0].status,'pending')
  const requestPacket = moderator.outgoing[0]
  await deliver(moderator,owner); await deliver(owner,moderator)
  const space = moderator.manager.spaces[0]
  assert.equal(space.channelRequests[0].status,'applied')
  assert.equal(spaceChannels(space).find(channel=>channel.id===change.channelId).name,'development')
  assert.equal(owner.manager.spaces[0].manifest.epoch,before.manifest.epoch,'channel organization does not need new membership keys')
  const message = await sealSpaceMessage({id:crypto.randomUUID(),spaceId:id,spaceEpoch:space.manifest.epoch,channelId:change.channelId,text:'Only in development',
    sender:{account:moderator.device.account,deviceId:moderator.device.deviceId},certificate:moderator.device.certificate,
    signingKey:moderator.device.keys.signing.privateKey,spaceKey:space.keyBytes})
  assert.equal(canReceiveSpaceMessage(owner.manager.spaces[0],message),true)
  await assert.rejects(openSpaceMessage({envelope:{...message,channelId:'general'},spaceId:id,spaceKey:space.keyBytes,network,trustedCertificates:[moderator.device.certificate]}), /signature/)
  const revision = owner.manager.spaces[0].manifest.revision
  moderator.outgoing.push(requestPacket); await deliver(moderator,owner); await deliver(owner,moderator)
  assert.equal(owner.manager.spaces[0].manifest.revision,revision,'replaying a command does not create another channel')
  await owner.manager.changeChannel(id,{action:'archive',channelId:change.channelId}); await deliver(owner,moderator)
  assert.equal(canSendToSpace(moderator.manager.spaces[0],moderator.device.certificate,change.channelId),false)
  assert.equal(canReceiveSpaceMessage(owner.manager.spaces[0],message),false)
  await assert.rejects(owner.manager.changeChannel(id,{action:'archive',channelId:'general'}), /default channel/)
  await owner.manager.changeChannel(id,{action:'restore',channelId:change.channelId}); await deliver(owner,moderator)
  assert.equal(canReceiveSpaceMessage(owner.manager.spaces[0],message),true)
  const restarted = new ChatSpaces(moderator.options); await restarted.refresh()
  assert.equal(spaceRole(restarted.spaces[0],moderator.device.certificate),'moderator')
  assert.equal(spaceChannels(restarted.spaces[0]).length,2)
})

test('demotion, membership changes and stale edits invalidate delayed moderator commands', async () => {
  const owner = await participant(), moderator = await participant()
  const id = await owner.manager.create('Permission checks'), invite = await owner.manager.createInvitation(id)
  await join(owner,moderator,id,invite)
  await owner.manager.setModerator(id,moderator.device.account,true); await deliver(owner,moderator)
  const channel = await owner.manager.changeChannel(id,{action:'create',name:'planning'}); await deliver(owner,moderator)
  await moderator.manager.changeChannel(id,{action:'edit',channelId:channel.channelId,name:'old-edit',topic:''})
  await owner.manager.changeChannel(id,{action:'edit',channelId:channel.channelId,name:'new-edit',topic:''})
  await deliver(moderator,owner); await deliver(owner,moderator)
  assert.equal(moderator.manager.spaces[0].channelRequests.at(-1).status,'rejected')
  assert.match(moderator.manager.spaces[0].channelRequests.at(-1).error,/channel changed/)
  assert.equal(spaceChannels(owner.manager.spaces[0]).find(item=>item.id===channel.channelId).name,'new-edit')
  await moderator.manager.changeChannel(id,{action:'create',name:'delayed'})
  const delayed = [...moderator.outgoing]
  await owner.manager.setModerator(id,moderator.device.account,false)
  await deliver(moderator,owner); await deliver(owner,moderator)
  assert.equal(spaceRole(moderator.manager.spaces[0],moderator.device.certificate),'member')
  assert.equal(moderator.manager.spaces[0].channelRequests.at(-1).status,'rejected')
  await owner.manager.setModerator(id,moderator.device.account,true); await deliver(owner,moderator)
  moderator.outgoing.push(...delayed); await deliver(moderator,owner); await deliver(owner,moderator)
  assert.equal(spaceChannels(owner.manager.spaces[0]).some(item=>item.name==='delayed'),false,'regranting role does not revive old permission nonce')
  await owner.manager.remove(id,moderator.device.account); await deliver(owner,moderator)
  assert.deepEqual(owner.manager.spaces[0].manifest.roles,[])
  await assert.rejects(moderator.manager.changeChannel(id,{action:'create',name:'removed'}), /owner or a moderator/)
})

test('signed pre-channel Space documents keep implicit general history and upgrade without resetting identity or keys', async () => {
  const owner = await participant(), id = await owner.manager.create('Existing Space')
  const state = owner.manager.spaces[0]
  delete state.manifest.channels; delete state.manifest.roles; delete state.manifest.signature
  const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])) : value
  const signature = new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},owner.device.keys.signing.privateKey,
    encodeWire('space-document',sorted(state.manifest))))
  state.manifest.signature = btoa(String.fromCharCode(...signature)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
  await owner.options.save([state])
  const upgraded = new ChatSpaces(owner.options); await upgraded.refresh()
  assert.equal(spaceChannels(upgraded.spaces[0])[0].id,'general')
  const key = upgraded.spaces[0].keyBytes, epoch = upgraded.spaces[0].manifest.epoch
  await upgraded.changeChannel(id,{action:'create',name:'new-channel'})
  assert.deepEqual(upgraded.spaces[0].keyBytes,key)
  assert.equal(upgraded.spaces[0].manifest.epoch,epoch)
  assert.equal(upgraded.spaces[0].spaceId,id)
  assert.equal(spaceChannels(upgraded.spaces[0]).length,2)
})
