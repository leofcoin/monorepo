export type NodeOptions = {
  network?: string
  networkVersion?: string
  version?: string
  stars?: string[]
  autoStart?: boolean
  root?: string
  storePrefix?: string
  storeNamespace?: string
  /** Optional explicit transport ID; otherwise generated and persisted per node. Not a wallet/account ID. */
  routingId?: string
  /** Browser account scope for the shared main-tab node's transport ID. */
  routingAccount?: string
}

export default class Node {
  constructor(config?: NodeOptions, password?: string)
  ready: Promise<this>
}
