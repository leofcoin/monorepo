import EasyWorker from '@leofcoin/workers/binary-worker'
import { jsonStringifyBigInt } from '@leofcoin/utils'

/** No canonical worker handle, signer, network fetch or writable store is exposed. */
export class ReadOnlyMachine {
  #worker
  #pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: any }>()
  #tail = Promise.resolve()
  #queued = 0
  #seed
  #cache = new Map<string, any>()
  #cacheBytes = 0
  #closed = false

  constructor(private workerPath: string, private readContract: (hash: string) => Promise<Uint8Array>) {}

  read(seed, contract: string, method: string, params: any[] = [], sender = 'leofcoin:read-only') {
    if (this.#closed) return Promise.reject(new Error('Read-only machine is closed'))
    if (typeof contract !== 'string' || !contract || typeof method !== 'string' || !method ||
      ['constructor', '__proto__', 'prototype'].includes(method) || !Array.isArray(params))
      return Promise.reject(new Error('Invalid read-only contract query'))
    if (this.#queued >= 32) return Promise.reject(new Error('Read-only query queue is full'))
    let key
    try {
      key = JSON.stringify({ contract, method, params, sender }, jsonStringifyBigInt)
      if (new TextEncoder().encode(key).byteLength > 65536) throw new Error('Read-only query is too large')
      params = structuredClone(params)
    } catch (error) { return Promise.reject(error) }
    this.#queued++
    const result = this.#tail.then(async () => {
      if (this.#closed) throw new Error('Read-only machine is closed')
      if (this.#seed !== seed) { this.#seed = seed; this.#cache.clear(); this.#cacheBytes = 0 }
      if (this.#cache.has(key)) return structuredClone(this.#cache.get(key).value)
      try {
        await this.#start()
        const initialized = await this.#request('init', {
          readOnly: true, fromState: true, blocks: [], peerid: 'leofcoin:read-only',
          lastBlock: seed.lastBlock,
          state: seed.states,
          info: seed.info
        })
        if (initialized !== true) throw new Error('Worker does not support isolated contract queries')
        const value = await this.#request('read', { contract, method, params, sender })
        const bytes = new TextEncoder().encode(JSON.stringify(value, jsonStringifyBigInt) ?? '').byteLength
        if (bytes > 4 * 1024 * 1024) throw new Error('Read-only result is too large')
        while (this.#cache.size && (this.#cache.size >= 64 || this.#cacheBytes + bytes > 4 * 1024 * 1024)) {
          const oldest = this.#cache.keys().next().value
          this.#cacheBytes -= this.#cache.get(oldest).bytes
          this.#cache.delete(oldest)
        }
        this.#cache.set(key, { value: structuredClone(value), bytes })
        this.#cacheBytes += bytes
        return value
      } catch (error) {
        this.#stop()
        throw error
      }
    })
    this.#tail = result.then(() => undefined, () => undefined)
    return result.finally(() => { this.#queued-- })
  }

  async #start() {
    if (this.#worker) return
    const worker = await new EasyWorker(this.workerPath, { serialization: 'advanced', type: 'module' })
    if (this.#closed) { worker.terminate(); throw new Error('Read-only machine is closed') }
    this.#worker = worker
    worker.onmessage(async message => {
      if (this.#worker !== worker) return
      if (message.type === 'ask') {
        try {
          const input = message.question === 'peers' ? [] : message.question === 'contract'
            ? await this.readContract(message.input) : undefined
          if (this.#worker === worker) worker.postMessage({ id: message.id, input })
        } catch {
          if (this.#worker === worker) worker.postMessage({ id: message.id, input: undefined })
        }
        return
      }
      const pending = this.#pending.get(message.id)
      if (!pending) return
      if (message.type !== 'response' && !['initError', 'readError'].includes(message.type)) return
      clearTimeout(pending.timer)
      this.#pending.delete(message.id)
      if (message.type === 'response') pending.resolve(message.value)
      else pending.reject(new Error(message.message || 'Read-only worker failed'))
    })
    worker.onerror(() => { if (this.#worker === worker) this.#stop() })
    worker.worker?.once?.('exit', () => { if (this.#worker === worker) this.#stop() })
  }

  #request(type, input) {
    return new Promise<any>((resolve, reject) => {
      const id = crypto.randomUUID()
      const timer = setTimeout(() => this.#stop(new Error('Read-only query timed out')), 10000)
      this.#pending.set(id, { resolve, reject, timer })
      try { this.#worker.postMessage({ id, type, input }) }
      catch (error) { this.#stop(error) }
    })
  }

  #stop(error = new Error('Read-only worker stopped')) {
    const worker = this.#worker
    this.#worker = undefined
    for (const pending of this.#pending.values()) { clearTimeout(pending.timer); pending.reject(error) }
    this.#pending.clear()
    worker?.terminate()
  }

  close() { this.#closed = true; this.#cache.clear(); this.#cacheBytes = 0; this.#seed = undefined; this.#stop() }
}
