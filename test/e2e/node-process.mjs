const emit = (type, value = {}) => process.stdout.write(`E2E_EVENT:${JSON.stringify({ type, ...value })}\n`)

const { default: Node } = await import('../../packages/chain/exports/node.js')
const node = new Node(
  {
    network: process.env.LEOFCOIN_E2E_NETWORK || 'leofcoin:e2e',
    networkVersion: 'e2e',
    root: '.leofcoin/e2e',
    stars: [],
    autoStart: false
  },
  process.env.LEOFCOIN_E2E_PASSWORD
)
await node.ready

const { default: Chain } = await import('../../packages/chain/exports/chain.js')
const chain = new Chain({ network: 'leofcoin:e2e', networkVersion: 'e2e' })
await chain.ready

const status = async () => ({
  identity: globalThis.peernet.id,
  account: globalThis.peernet.selectedAccount,
  peers: globalThis.peernet.peers.length,
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

for (const event of ['uncaughtException', 'unhandledRejection']) {
  process.on(event, (error) => {
    emit('error', { message: error?.message || String(error), stack: error?.stack })
    process.exit(1)
  })
}
