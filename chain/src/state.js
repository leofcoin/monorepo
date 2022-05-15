import pako from 'pako'

export default class State {
  constructor() {
    // return this.#init()
  }

  // async #init() {
  //   const state = await stateStore.get()
  //   for (const [key, value] of Object.entries(state)) {
  //
  //   }
  //
  //   return this
  // }

  async put(key, value, isCompressed = false) {
    value = isCompressed ? isCompressed : await pako.deflate(value)
    await stateStore.put(key, value)
  }

  async get(key) {
    const value = await stateStore.get(key)
    return pako.inflate(value)
  }
}
