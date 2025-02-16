import networks from '@leofcoin/networks'

export type NodeOptions = {
  network?: string
  networkVersion?: string
  version?: string
  stars?: string[]
}

export const DEFAULT_NODE_OPTIONS = {
  network: 'leofcoin:peach',
  networkVersion: 'peach',
  version: '0.1.0',
  stars: networks.leofcoin.peach.stars
}
