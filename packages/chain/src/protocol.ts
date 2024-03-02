import type { ChainConfig } from './types.js'

export const limit = 1800
export const transactionLimit = 1000
export const requestTimeout = 30_000
export const syncTimeout = 30_000

export class Protocol {
  version: string
  resolveTimeout: EpochTimeStamp = 10_000

  constructor(config: ChainConfig) {
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
