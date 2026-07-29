const emit = (type, value = {}) => process.stdout.write(`E2E_EVENT:${JSON.stringify({ type, ...value })}\n`)

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
  lastBlock: await chain.lastBlock
})

emit('ready', await status())
process.stdin.setEncoding('utf8')
process.stdin.on('data', async (input) => {
  for (const command of input.trim().split(/\s+/)) {
    if (command === 'status') emit('status', await status())
    if (command === 'shutdown') {
      emit('stopped')
      process.exit(0)
    }
  }
})
