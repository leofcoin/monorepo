class LeofcoinError extends Error {
  #message: string
  constructor(message) {
    super()
    this.#message = message
  }

  get message() {
    return `${this.name}: ${this.#message}`
  }
}

class ResolveError extends LeofcoinError {
  name: string = 'ResolveError'
  constructor(message) {
    super(message)
  }
}

export const RESOLVE_ERROR = 'error resolving'
