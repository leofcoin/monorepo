import type { ChainConfig } from './types.js'
import addresses from '@leofcoin/addresses'
import { PQ_NETWORK } from '@leofcoin/lib/pq'
import { assertPqGenesis, type PqGenesis } from '@leofcoin/lib/pq-genesis'

export const limit = 1800
export const transactionLimit = 2500
export const requestTimeout = 30_000
export const syncTimeout = 30_000

export class Protocol {
  protected readonly genesis?: PqGenesis
  protected get chainAddresses() { return this.genesis?.addresses ?? addresses }
  version!: string
  resolveTimeout: EpochTimeStamp = 10_000

  constructor(config?: ChainConfig) {
    if (config?.network === PQ_NETWORK) {
      assertPqGenesis(config.genesis)
      Object.defineProperty(this, 'genesis', { value: config.genesis, writable: false, configurable: false })
    } else if (config?.genesis) throw new Error('Dynamic PQ genesis forbidden on classical networks')
    if (config?.resolveTimeout) this.resolveTimeout = config.resolveTimeout
  }
  get limit() {
    return limit
  }

  get transactionLimit() {
    return transactionLimit
  }

  get requestTimeout() {
    return requestTimeout
  }

  get syncTimeout() {
    return syncTimeout
  }
}

export { Protocol as default }
