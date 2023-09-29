export class LeofcoinError extends Error {
  #message: string
  constructor(message: string, options?: {cause: Error | LeofcoinError}) {
    super(message, options)
    this.#message = message
  }

  get message() {
    return `${this.name}: ${this.#message}`
  }
}

export class ResolveError extends LeofcoinError {
  name: string = 'ResolveError'
}

export class SyncError extends LeofcoinError {
  name: string = 'SyncError'
}

export const isResolveError = (error: LeofcoinError) => error.name === 'ResolveError'
export const isSyncError = (error: LeofcoinError) => error.name === 'SyncError'