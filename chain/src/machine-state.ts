import pako from 'pako'

export default class MachineState {
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

  async put(key, value, isCompressed = true) {
    value = isCompressed ? value : await pako.deflate(value)
    await stateStore.put(key, value)
  }

  async get(key, isCompressed = true) {
    const value = await stateStore.get(key)
    return isCompressed = true ? pako.inflate(value) : value
  }

  updateState(block) {
    // block.decoded.index
    // this.#isUpdateNeeded()
  }
}
