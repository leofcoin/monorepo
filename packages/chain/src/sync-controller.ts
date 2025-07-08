export default class SyncController {
  #busy: boolean
  #loading: boolean
  #resolving: boolean
  #fullyResolved: boolean
  #fullyLoaded: boolean
  #retryCount: number = 0
  #maxRetries: number = 3
  #timeouts: Map<string, NodeJS.Timeout> = new Map()

  get busy() {
    return this.#busy
  }

  get loading() {
    return this.#loading
  }

  get resolving() {
    return this.#resolving
  }

  get fullyResolved() {
    return this.#fullyResolved
  }

  get fullyLoaded() {
    return this.#fullyLoaded
  }

  constructor() {
    this.#busy = false
    this.#loading = false
    this.#resolving = false
    this.#fullyResolved = false
    this.#fullyLoaded = false
  }

  /**
   * Resolves/rejects a promise or rejects on timeout with retry logic
   */
  resolve(operation: () => Promise<any>, timeoutMs: number = 30000): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const operationId = Math.random().toString(36)

      const timeout = setTimeout(() => {
        this.#timeouts.delete(operationId)
        if (this.#retryCount < this.#maxRetries) {
          this.#retryCount++
          console.warn(`Operation timeout, retrying... (${this.#retryCount}/${this.#maxRetries})`)
          this.resolve(operation, timeoutMs).then(resolve).catch(reject)
        } else {
          this.#retryCount = 0
          reject(new Error(`Operation timeout after ${this.#maxRetries} retries`))
        }
      }, timeoutMs)

      this.#timeouts.set(operationId, timeout)

      try {
        const result = await operation()
        clearTimeout(timeout)
        this.#timeouts.delete(operationId)
        this.#retryCount = 0
        resolve(result)
      } catch (error) {
        clearTimeout(timeout)
        this.#timeouts.delete(operationId)
        if (this.#retryCount < this.#maxRetries) {
          this.#retryCount++
          console.warn(`Operation failed, retrying... (${this.#retryCount}/${this.#maxRetries}):`, error.message)
          this.resolve(operation, timeoutMs).then(resolve).catch(reject)
        } else {
          this.#retryCount = 0
          reject(error)
        }
      }
    })
  }

  stop() {
    // Clear all timeouts
    for (const [id, timeout] of this.#timeouts) {
      clearTimeout(timeout)
    }
    this.#timeouts.clear()
    this.#busy = false
    this.#loading = false
    this.#resolving = false
  }
}
