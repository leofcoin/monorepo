import networks from '@leofcoin/networks'

export const PROTOCOL_VERSION = '0.2.0'
export const MACHINE_STATE_VERSION = '1' // Bump when state encoding changes
export const REACHED_ONE_ZERO_ZERO = false // set to true when protocol reaches v1.0.0

export type NodeOptions = {
  network?: string
  networkVersion?: string
  version?: string
  stars?: string[]
  autoStart?: boolean
  root?: string
  storePrefix?: string
  storeNamespace?: string
  freshIdentity?: boolean
}

export const DEFAULT_NODE_OPTIONS = {
  autoStart: false,
  network: 'leofcoin:peach',
  networkVersion: 'peach',
  version: PROTOCOL_VERSION,
  stars: networks.leofcoin.peach.stars
}
