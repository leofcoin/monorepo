import { encodeWire, decodeWire } from '@leofcoin/binary'

export default class BinarySocketClient {
  socket: WebSocket
  pending = new Map<string, { resolve: Function; reject: Function; timer: ReturnType<typeof setTimeout> }>()
  listeners = new Map<string, Set<Function>>()
  pubsub = {
    publish: (topic, value) => { for (const handler of this.listeners.get(topic) || []) handler(value) },
    subscribe: (topic, handler) => {
      if (!this.listeners.has(topic)) this.listeners.set(topic, new Set())
      this.listeners.get(topic)!.add(handler)
      return () => this.listeners.get(topic)?.delete(handler)
    }
  }
  constructor(url: string, protocol: string) {
    this.socket = new WebSocket(url, `${protocol}.lfc-binary-v1`)
    this.socket.binaryType = 'arraybuffer'
  }
  async init() {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.socket.close(); reject(new Error('Binary RPC connection timed out')) }, 10000)
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
      this.socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Binary RPC connection failed')) }, { once: true })
    })
    this.socket.addEventListener('message', event => {
      try {
        if (!(event.data instanceof ArrayBuffer)) throw new Error('Binary RPC frames required')
        const message = decodeWire('rpc-response', new Uint8Array(event.data), { maxBytes: 4 * 1024 * 1024 })
        if (!message || typeof message.id !== 'string' || !Number.isInteger(message.status)) throw new Error('Invalid RPC response')
        const pending = this.pending.get(message.id)
        if (!pending) return
        clearTimeout(pending.timer); this.pending.delete(message.id)
        if (message.status >= 400) pending.reject(new Error(message.value?.error || `RPC failed (${message.status})`))
        else pending.resolve(message.value)
      } catch (error) { this.fail(error); this.socket.close(1002, 'Invalid binary RPC') }
    })
    this.socket.addEventListener('close', () => this.fail(new Error('Binary RPC connection closed')))
    this.socket.addEventListener('error', () => this.fail(new Error('Binary RPC connection failed')))
    return this
  }
  fail(error) { for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(error) }; this.pending.clear() }
  request({ url, params }) {
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Binary RPC is not connected'))
    if (this.pending.size >= 32) return Promise.reject(new Error('Too many pending RPC requests'))
    const id = crypto.randomUUID()
    const bytes = encodeWire('rpc-request', { id, url, params }, { maxBytes: 1048576 })
    return new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Binary RPC request timed out')) }, 10000)
      this.pending.set(id, { resolve, reject, timer })
      try { this.socket.send(bytes as any) }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error) }
    })
  }
  close() { this.fail(new Error('Binary RPC client closed')); this.socket.close() }
}
