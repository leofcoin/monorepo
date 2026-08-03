const stringify = (value) => JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item))
const emit = (type, value = {}) => process.stdout.write(`E2E_EVENT:${stringify({ type, ...value })}\n`)

for (const event of ['uncaughtException', 'unhandledRejection']) {
  process.on(event, (error) => {
    emit('error', { message: error?.message || String(error), stack: error?.stack })
    process.exit(1)
  })
}

const { default: Node } = await import('../../packages/chain/exports/node.js')
const node = new Node(
  {
    network: 'leofcoin:e2e',
    networkVersion: 'e2e',
    root: '.leofcoin/e2e',
    stars: process.env.LEOFCOIN_E2E_STAR ? [process.env.LEOFCOIN_E2E_STAR] : [],
    autoStart: false
  },
  process.env.LEOFCOIN_E2E_PASSWORD
)
await node.ready

const discoveryEvents = []
globalThis.pubsub.subscribe('peer:joined', (peer) => {
  discoveryEvents.push(peer)
  emit('peer:joined', { peer })
})
globalThis.pubsub.subscribe('peer:connected', (peerId) => {
  emit('peer:connected', { peerId })
})

const { default: Chain } = await import('../../packages/chain/exports/chain.js')
const chain = new Chain({ network: 'leofcoin:e2e', networkVersion: 'e2e' })
await chain.ready

const { BlockMessage } = await import('@leofcoin/messages')
const { signTransaction } = await import('@leofcoin/lib')
const { default: addresses } = await import('@leofcoin/addresses')

const storeText = async (store, key) => {
  if (!(await store.has(key))) return null
  return new TextDecoder().decode(await store.get(key))
}

const appendFixtureBlock = async () => {
  const previous = await chain.lastBlock
  const index = Number(previous?.index ?? -1) + 1
  const producer = globalThis.peernet.selectedAccount
  const timestamp = Date.now()
  const block = {
    index,
    previousHash: previous?.hash || '0x0',
    timestamp,
    reward: 150n,
    fees: 0n,
    transactions: [],
    validators: [{ address: producer, reward: 150n }],
    producer,
    producerProof: '',
    protocolVersion: chain.version
  }
  const unsignedBlockHash = await new BlockMessage(block).hash()
  const proof = await signTransaction(
    {
      from: producer,
      to: addresses.validators,
      method: 'produceBlock',
      params: [unsignedBlockHash],
      timestamp
    },
    globalThis.peernet.identity
  )
  const encoded = new BlockMessage({ ...block, producerProof: proof.signature }).encoded
  const message = new BlockMessage(encoded)
  const hash = await message.hash()

  await globalThis.peernet.put(hash, message.encoded, 'block')
  await chain.machine.addLoadedBlock({ ...message.decoded, hash, loaded: true })
  await chain.updateState(message)
  return { hash, index }
}

const status = async () => ({
  identity: globalThis.peernet.id,
  account: globalThis.peernet.selectedAccount,
  peers: globalThis.peernet.peers.length,
  connectedPeers: Object.values(globalThis.peernet.connections || {}).filter((peer) => peer.connected).length,
  clientStarted: Boolean(globalThis.peernet.client),
  stars: globalThis.peernet.stars,
  discoveryEvents: discoveryEvents.length,
  discoverySubscribers: globalThis.pubsub.subscriberCount('peer:joined'),
  chain: chain.state,
  lastBlock: await chain.lastBlock,
  blockHashes: (await globalThis.blockStore.keys()).sort(),
  stateSnapshot: await storeText(globalThis.stateStore, 'lastBlock')
})

emit('ready', await status())
process.stdin.setEncoding('utf8')
process.stdin.on('data', async (input) => {
  for (const command of input.trim().split(/\s+/)) {
    if (command === 'status') emit('status', await status())
    if (command === 'append-block') emit('block:produced', await appendFixtureBlock())
    if (command === 'shutdown') {
      emit('stopped')
      process.exit(0)
    }
  }
})
