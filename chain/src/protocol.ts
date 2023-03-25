export const limit = 1800
export const transactionLimit = 1800
export const requestTimeout = 30_000
export const syncTimeout = 30_000

export class Protocol {
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