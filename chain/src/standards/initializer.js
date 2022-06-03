export default class Initializer {
  #initialized = false
  constructor() {
    this.#initialized = true
  }

  get initialized() {
    return this.#initialized
  }
}
