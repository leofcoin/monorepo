const queued = new WeakSet()

export function queueBrowserStoreReads(store) {
  const backend = store.db
  if (!Array.isArray(backend?.queue) || typeof backend.runQueue !== 'function')
    throw new Error(`Browser store ${store.name} does not expose the expected operation queue`)
  if (queued.has(backend)) return store
  for (const method of ['keys', 'values', 'entries', 'size']) {
    const original = backend[method].bind(backend)
    backend[method] = (...args) => new Promise((resolve, reject) => {
      // Join the same queue as get/put/delete so no write can invalidate a File snapshot.
      backend.queue.push(async () => {
        try {
          resolve(await original(...args))
        } catch (error) {
          reject(new Error(`Browser store ${store.name} ${method} failed: ${error?.name || 'Error'}: ${error?.message || String(error)}`, { cause: error }))
        }
      })
      void backend.runQueue()
    })
  }
  queued.add(backend)
  return store
}
