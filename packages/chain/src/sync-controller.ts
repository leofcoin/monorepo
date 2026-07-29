export default class SyncController {
  #busy: boolean
  #loading: boolean
  #resolving: boolean
  #fullyResolved: boolean
  #fullyLoaded: boolean
  #maxRetries: number = 3
  #operationSequence: number = 0
  #generation: number = 0
  #timeouts: Map<string, { timeout: NodeJS.Timeout; reject: (error: Error) => void }> = new Map()

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
  async resolve(operation: () => Promise<any>, timeoutMs: number = 30000): Promise<any> {
    const generation = this.#generation
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.#maxRetries; attempt += 1) {
      if (generation !== this.#generation) throw new Error('Operation stopped')

      try {
        return await this.#runAttempt(operation, timeoutMs)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (generation !== this.#generation) throw new Error('Operation stopped')
        if (attempt === this.#maxRetries) break
        console.warn(`Operation failed, retrying... (${attempt + 1}/${this.#maxRetries}):`, lastError.message)
      }
    }

    throw lastError ?? new Error(`Operation failed after ${this.#maxRetries} retries`)
  }

  #runAttempt(operation: () => Promise<any>, timeoutMs: number): Promise<any> {
    const operationId = String(++this.#operationSequence)

    return new Promise((resolve, reject) => {
      let settled = false
      const settle = (callback: (value?: any) => void, value?: any) => {
        if (settled) return
        settled = true
        const pending = this.#timeouts.get(operationId)
        if (pending) clearTimeout(pending.timeout)
        this.#timeouts.delete(operationId)
        callback(value)
      }

      const timeout = setTimeout(
        () => settle(reject, new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
      this.#timeouts.set(operationId, {
        timeout,
        reject: (error) => settle(reject, error)
      })

      Promise.resolve()
        .then(operation)
        .then((result) => settle(resolve, result))
        .catch((error) => settle(reject, error))
    })
  }

  stop() {
    this.#generation += 1
    for (const { reject } of this.#timeouts.values()) {
      reject(new Error('Operation stopped'))
    }
    this.#timeouts.clear()
    this.#busy = false
    this.#loading = false
    this.#resolving = false
  }
}
