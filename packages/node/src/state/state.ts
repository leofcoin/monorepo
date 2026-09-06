const _state: any = {}

export const state = {
  ready: new Promise<boolean>((resolve) => {
    _state.readyResolve = resolve
  })
}

globalThis.pubsub.subscribe('node:ready', (value) => {
  value && _state.readyResolve(true)
})
