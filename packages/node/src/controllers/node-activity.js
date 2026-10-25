const MAX_EVENTS = 300
const encoder = new TextEncoder()

const byteLength = (value) => {
  if (typeof value === 'string') return encoder.encode(value).byteLength
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value.byteLength
  if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size
  return null
}

function endpointOrigin(value, base) {
  try {
    const url = new URL(typeof value === 'string' || value instanceof URL ? value : value?.url, base)
    return url.origin
  } catch {
    return 'Invalid endpoint URL'
  }
}

export class NodeActivity {
  #events = []
  #totals = this.#emptyTotals()
  #nextId = 0
  #restores = []
  #peerRestores = new Map()
  #socketListeners = new Map()
  #global
  #session = 0

  #emptyTotals() {
    return { incoming: 0, outgoing: 0, errors: 0, bytesIn: 0, bytesOut: 0 }
  }

  record({ direction, transport, operation, remote = '', bytes = null, outcome = 'observed', duration = null }) {
    const entry = {
      id: ++this.#nextId, timestamp: Date.now(), direction, transport,
      operation: String(operation).slice(0, 80), remote: String(remote).slice(0, 200),
      bytes, outcome, duration
    }
    this.#events.unshift(entry)
    if (this.#events.length > MAX_EVENTS) this.#events.length = MAX_EVENTS
    this.#totals[direction === 'in' ? 'incoming' : 'outgoing']++
    if (outcome === 'error') this.#totals.errors++
    if (bytes !== null) this.#totals[direction === 'in' ? 'bytesIn' : 'bytesOut'] += bytes
    return entry.id
  }

  #complete(id, outcome, started) {
    const entry = this.#events.find((event) => event.id === id)
    if (entry) {
      entry.outcome = outcome
      entry.duration = Math.max(0, performance.now() - started)
    }
    if (outcome === 'error') this.#totals.errors++
  }

  snapshot() {
    return { events: this.#events.map((event) => ({ ...event })), totals: { ...this.#totals } }
  }

  clear() {
    this.#events = []
    this.#totals = this.#emptyTotals()
  }

  #wrap(target, key, makeWrapper, restores) {
    const original = target?.[key]
    if (typeof original !== 'function') return
    const own = Object.getOwnPropertyDescriptor(target, key)
    const wrapper = makeWrapper(original)
    target[key] = wrapper
    restores.push(() => {
      if (target[key] !== wrapper) return
      if (own) Object.defineProperty(target, key, own)
      else delete target[key]
    })
  }

  #observeRequest(target, key, transport, remote, restores) {
    const monitor = this
    this.#wrap(target, key, (original) => function (...args) {
      const session = monitor.#session
      const started = performance.now()
      const id = monitor.record({
        direction: 'out', transport, operation: 'request', remote, bytes: byteLength(args[0]), outcome: 'pending'
      })
      let result
      try {
        result = Reflect.apply(original, this, args)
      } catch (error) {
        monitor.#complete(id, 'error', started)
        throw error
      }
      Promise.resolve(result).then(
        (response) => {
          if (session !== monitor.#session) return
          monitor.#complete(id, 'completed', started)
          monitor.record({ direction: 'in', transport, operation: 'response', remote, bytes: byteLength(response) })
        },
        () => { if (session === monitor.#session) monitor.#complete(id, 'error', started) }
      )
      return result
    }, restores)
  }

  refreshPeers(peernet = this.#global?.peernet) {
    const active = new Set()
    if (peernet) {
      active.add(peernet)
      if (!this.#peerRestores.has(peernet)) {
        const restores = []
        const monitor = this
        this.#wrap(peernet, '_protoHandler', (original) => function (message, peer, from, ...args) {
          monitor.record({
            direction: 'in', transport: 'P2P', operation: message?.proto?.name || 'message',
            remote: from || peer?.id || '', bytes: byteLength(message?.proto?.encoded)
          })
          return Reflect.apply(original, this, [message, peer, from, ...args])
        }, restores)
        this.#wrap(peernet, 'sendMessage', (original) => function (peer, id, data, ...args) {
          const session = monitor.#session
          const started = performance.now()
          const eventId = monitor.record({
            direction: 'out', transport: 'P2P', operation: 'message', remote: peer?.id || '',
            bytes: byteLength(data), outcome: 'pending'
          })
          let result
          try {
            result = Reflect.apply(original, this, [peer, id, data, ...args])
          } catch (error) {
            monitor.#complete(eventId, 'error', started)
            throw error
          }
          Promise.resolve(result).then(
            () => { if (session === monitor.#session) monitor.#complete(eventId, 'completed', started) },
            () => { if (session === monitor.#session) monitor.#complete(eventId, 'error', started) }
          )
          return result
        }, restores)
        this.#peerRestores.set(peernet, restores)
      }
      for (const [id, peer] of Object.entries(peernet.connections || {})) {
        if (!peer || typeof peer !== 'object') continue
        active.add(peer)
        if (this.#peerRestores.has(peer)) continue
        const restores = []
        this.#observeRequest(peer, 'request', 'P2P', id, restores)
        this.#peerRestores.set(peer, restores)
      }
    }
    for (const [target, restores] of this.#peerRestores) {
      if (active.has(target)) continue
      restores.reverse().forEach((restore) => restore())
      this.#peerRestores.delete(target)
    }
  }

  start(global = globalThis) {
    if (this.#global) return
    this.#global = global
    this.#session++
    const monitor = this
    this.#wrap(global, 'fetch', (original) => function (input, options) {
      const session = monitor.#session
      const remote = endpointOrigin(input, global.location?.href)
      const started = performance.now()
      const id = monitor.record({
        direction: 'out', transport: 'HTTP', operation: 'request', remote, outcome: 'pending'
      })
      let result
      try {
        result = Reflect.apply(original, this, [input, options])
      } catch (error) {
        monitor.#complete(id, 'error', started)
        throw error
      }
      Promise.resolve(result).then(
        (response) => {
          if (session !== monitor.#session) return
          monitor.#complete(id, response.ok ? 'completed' : 'error', started)
          monitor.record({ direction: 'in', transport: 'HTTP', operation: `HTTP ${response.status}`, remote })
        },
        () => { if (session === monitor.#session) monitor.#complete(id, 'error', started) }
      )
      return result
    }, this.#restores)
    if (typeof global.WebSocket === 'function') {
      const NativeWebSocket = global.WebSocket
      this.#wrap(NativeWebSocket.prototype, 'send', (original) => function (data) {
        let result
        try {
          result = Reflect.apply(original, this, [data])
        } catch (error) {
          monitor.record({
            direction: 'out', transport: 'WS', operation: 'message',
            remote: endpointOrigin(this.url, global.location?.href), bytes: byteLength(data), outcome: 'error'
          })
          throw error
        }
        monitor.record({
          direction: 'out', transport: 'WS', operation: 'message',
          remote: endpointOrigin(this.url, global.location?.href), bytes: byteLength(data)
        })
        return result
      }, this.#restores)
      const observed = new Proxy(NativeWebSocket, {
        construct(target, args, newTarget) {
          const socket = Reflect.construct(target, args, newTarget)
          const remote = endpointOrigin(socket.url, global.location?.href)
          const onMessage = (event) => monitor.record({
            direction: 'in', transport: 'WS', operation: 'message', remote, bytes: byteLength(event.data)
          })
          const onError = () => monitor.record({
            direction: 'in', transport: 'WS', operation: 'connection', remote, outcome: 'error'
          })
          const cleanup = () => {
            socket.removeEventListener('message', onMessage)
            socket.removeEventListener('error', onError)
            socket.removeEventListener('close', cleanup)
            monitor.#socketListeners.delete(socket)
          }
          socket.addEventListener('message', onMessage)
          socket.addEventListener('error', onError)
          socket.addEventListener('close', cleanup)
          monitor.#socketListeners.set(socket, cleanup)
          return socket
        }
      })
      global.WebSocket = observed
      this.#restores.push(() => { if (global.WebSocket === observed) global.WebSocket = NativeWebSocket })
    }
    this.refreshPeers()
  }

  stop() {
    this.#session++
    for (const restores of this.#peerRestores.values()) restores.reverse().forEach((restore) => restore())
    this.#peerRestores.clear()
    for (const cleanup of this.#socketListeners.values()) cleanup()
    this.#restores.reverse().forEach((restore) => restore())
    this.#restores = []
    this.#global = undefined
  }
}

export const nodeActivity = new NodeActivity()
