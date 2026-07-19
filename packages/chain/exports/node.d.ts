export type NodeOptions = {
  network?: string
  networkVersion?: string
  version?: string
  stars?: string[]
  autoStart?: boolean
  root?: string
  storePrefix?: string
  storeNamespace?: string
}

export default class Node {
  constructor(config?: NodeOptions, password?: string)
  ready: Promise<this>
}
