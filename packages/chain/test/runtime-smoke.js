const root = `.leofcoin-smoke-${process.pid}`
const { default: Node } = await import('../exports/node.js')
const node = new Node(
  {
    network: 'leofcoin:peach',
    networkVersion: 'peach',
    root,
    stars: [],
    autoStart: false
  },
  'operational-test'
)

await node.ready

const { default: Chain } = await import('../exports/chain.js')
const chain = new Chain({ network: 'leofcoin:peach', networkVersion: 'peach' })
const timeout = setTimeout(() => {
  console.error('CHAIN_READY_TIMEOUT')
  process.exit(2)
}, 20_000)

await chain.ready
clearTimeout(timeout)
console.log('CHAIN_READY', chain.state, await chain.lastBlock)
process.exit(0)
