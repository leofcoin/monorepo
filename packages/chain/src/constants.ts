import networks from '@leofcoin/networks'

// Consensus-breaking activation: binary-only typed messages and new content addresses.
// Do not reuse 0.4.x ledger state or connect it to this protocol.
export const PROTOCOL_VERSION = '0.5.0'
// Stable application identity, independent of protocol releases and genesis.
export const CHAIN_APP_ID = 'e0e759e2-3f0b-4d6b-9bb6-b547f655545b'
export const MACHINE_STATE_VERSION = '1' // Bump when state encoding changes
export const REACHED_ONE_ZERO_ZERO = false // set to true when protocol reaches v1.0.0

export type NodeOptions = {
  network?: string
  protocolVersion?: string
  chainId?: string
  stars?: string[]
  autoStart?: boolean
  root?: string
  storePrefix?: string
  storeNamespace?: string
  freshIdentity?: boolean
  routingId?: string
  routingAccount?: string
}

export const DEFAULT_NODE_OPTIONS = {
  autoStart: false,
  network: 'leofcoin:peach',
  protocolVersion: PROTOCOL_VERSION,
  stars: networks.leofcoin.peach.stars
}
