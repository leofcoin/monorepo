export interface MetaState {
  creator: address
  createdAt: bigint
}

export default class Meta {
  #creator: address
  #createdAt: bigint

  constructor(state?: MetaState) {
    if (state) {
      this.#creator = state.creator
      this.#createdAt = state.createdAt
    } else {
      this.#creator = msg.sender
      this.#createdAt = BigInt(Date.now())
    }
  }

  /**
   * get state object for snapshotting
   */
  get state(): {} {
    return { creator: this.#creator, createdAt: this.#createdAt }
  }

  get creator(): address {
    return this.#creator
  }

  get createdAt(): bigint {
    return this.#createdAt
  }
}
