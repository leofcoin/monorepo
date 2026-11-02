import EasyWorker from '@vandeurenglenn/easy-worker'
import { encodeWire, decodeWire } from '@leofcoin/binary'

/** Decoded objects stay inside a process. Every actual IPC payload is canonical bytes. */
export default class BinaryWorker {
  worker: any
  #transport: any
  #errorHandler: any
  constructor(url?, options = {}) {
    const transport = new EasyWorker(url, { ...options, serialization: 'advanced' })
    // EasyWorker's parent constructor is asynchronous, the child constructor is not.
    if (transport && typeof transport.then === 'function')
      return transport.then(value => { this.#transport = value; this.worker = value.worker; return this }) as any
    this.#transport = transport
    this.worker = transport.worker
  }
  postMessage(value) { this.#transport.postMessage(encodeWire('worker', value)) }
  onmessage(handler) {
    this.#transport.onmessage(bytes => {
      let value
      try { value = decodeWire('worker', bytes) }
      catch (error) { if (this.#errorHandler) this.#errorHandler(error); else throw error; return }
      handler(value)
    })
  }
  onerror(handler) { this.#errorHandler = handler; this.#transport.onerror(handler) }
  terminate() { return this.#transport.terminate() }
  async once(value) {
    let timer
    try {
      return await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Binary worker request timed out')), 10000)
        this.onerror(reject)
        this.onmessage(resolve)
        this.postMessage(value)
      })
    } finally { clearTimeout(timer); this.terminate() }
  }
}
