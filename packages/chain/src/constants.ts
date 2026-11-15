import networks from '@leofcoin/networks'
import type { PqGenesis } from '@leofcoin/lib/pq-genesis'

// Enlarged block limits; previous testnet ledgers require an explicit reset or migration.
export const PROTOCOL_VERSION = '0.9.0'
// Stable application identity, independent of protocol releases and genesis.
export const CHAIN_APP_ID = 'e0e759e2-3f0b-4d6b-9bb6-b547f655545b'
export const MACHINE_STATE_VERSION = '1' // Bump when state encoding changes

export type NodeOptions = {
  genesis?: PqGenesis
  identity?: object
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
  transport?: { webrtc?: { backend?: string; [key: string]: unknown }; [key: string]: unknown }
}

export const DEFAULT_NODE_OPTIONS = {
  autoStart: false,
  network: 'leofcoin:peach',
  protocolVersion: PROTOCOL_VERSION,
  stars: networks.leofcoin.peach.stars
}
