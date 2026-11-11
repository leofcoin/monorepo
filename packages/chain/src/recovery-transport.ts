import { requestTimeout } from './protocol.js'

// Shared by the node wrapper and recovery. Transport readiness is deliberately
// independent of chain readiness; connecting must never enable consensus.
const starts = new WeakMap<object, Promise<void>>()

export function startRecoveryTransport(peernet): Promise<void> {
  if (typeof peernet?.start !== 'function') return Promise.resolve()
  const existing = starts.get(peernet)
  if (existing) return existing
  const starting = Promise.resolve().then(() => peernet.start()).catch(error => {
    starts.delete(peernet)
    throw error
  })
  starts.set(peernet, starting)
  return starting
}

/** One bounded request, including startup/discovery and peers arriving late. */
export function requestRecoveryContent<T>(peernet, fetch: (id: string, peer: any) => Promise<T>, timeoutMs = requestTimeout): Promise<T> {
  return new Promise((resolve, reject) => {
    let done = false
    let poll: ReturnType<typeof setTimeout> | undefined
    let active = 0
    const attempted = new Set<object>()
    const errors: unknown[] = []
    const discovering = typeof peernet.start === 'function' && peernet.stars?.length !== 0
    const stop = () => { done = true; clearTimeout(deadline); clearTimeout(poll) }
    const unavailable = () => {
      const reason = attempted.size === 0 ? 'No connected peers became available for content recovery' :
        `No content provider succeeded (${attempted.size} connected peers queried)`
      stop()
      reject(new Error(reason, { cause: new AggregateError(errors, reason) }))
    }
    const deadline = setTimeout(unavailable, timeoutMs)
    const scan = () => {
      if (done) return
      for (const [id, peer] of Object.entries(peernet.connections || {}) as [string, any][]) {
        if (id === peernet.id || !peer?.connected || typeof peer.request !== 'function' || attempted.has(peer)) continue
        attempted.add(peer)
        active++
        // Negative replies must not beat a valid, slower provider. Each live
        // connection is queried once, not continuously reprobed while waiting.
        Promise.resolve().then(() => fetch(id, peer)).then(value => {
          if (done) return
          stop()
          resolve(value)
        }, error => {
          if (done) return
          errors.push(error)
          active--
          if (!discovering && active === 0) unavailable()
        })
      }
      if (!discovering && active === 0) { unavailable(); return }
      poll = setTimeout(scan, 100)
    }
    // The deadline also bounds a stalled transport.start(). Do not expose a
    // ready chain just to obtain a transport or wait forever for a provider.
    startRecoveryTransport(peernet).then(() => { if (!done) scan() }, error => {
      if (done) return
      stop()
      reject(new Error('Recovery transport could not start', { cause: error }))
    })
  })
}
