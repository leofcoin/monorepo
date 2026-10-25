export type CanonicalTransition = { markMutating(): void }

/** One writer for gossip, consensus commits and catch-up on this state machine. */
export class CanonicalStateQueue {
  #tail: Promise<void> = Promise.resolve()
  #failed = false
  #failure: unknown

  run<T>(operation: (transition: CanonicalTransition) => Promise<T>): Promise<T> {
    const result = this.#tail.then(async () => {
      if (this.#failed) {
        throw new Error('Canonical state application halted after a failed mutation; restart and recover state', {
          cause: this.#failure
        })
      }
      let mutating = false
      try {
        return await operation({ markMutating: () => { mutating = true } })
      } catch (error) {
        // Validation failures do not poison the queue. Once mutations may have
        // happened, never replay on top of an uncertain, partially applied state.
        if (mutating) {
          this.#failed = true
          this.#failure = error
        }
        throw error
      }
    })
    this.#tail = result.then(() => undefined, () => undefined)
    return result
  }
}
