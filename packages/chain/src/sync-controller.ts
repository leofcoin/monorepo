export default class SyncController {
  #busy: boolean
  #loading: boolean
  #resolving: boolean
  #fullyResolved: boolean
  #fullyLoaded: boolean

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
   * Resolves/rejects a promise or rejects on timeout
   */
  resolve() {}
}
