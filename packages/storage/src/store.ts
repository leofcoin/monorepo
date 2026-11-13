import { join } from 'path'
import { init, isNotFoundError } from './utils.js'
import KeyPath from './path.js'
import KeyValue from './value.js'
import { ClassicLevel, type IteratorOptions } from 'classic-level'
import type { StorageBatchOperation } from './storage.js'

export default class Store {
  db!: ClassicLevel<string, Uint8Array>
  name!: string
  root!: string
  version!: number
  #activeReads = 0
  #activeWrite = false
  #queue: { mode: 'read' | 'write'; run: () => Promise<void> }[] = []

  async init(name: string, root: string, version: number, inWorker: boolean, homedir: boolean) {
    this.name = name
    this.root = await init(root, homedir)
    this.version = version
    this.db = new ClassicLevel(join(this.root, this.name), { valueEncoding: 'view' })
  }

  toKeyPath(key: string | Uint8Array | KeyPath) {
    return new KeyPath(key).toString()
  }

  toKeyValue(value: string | Uint8Array | KeyValue) {
    return new KeyValue(value).uint8Array
  }

  toUint8Array(buffer: Uint8Array) {
    return Buffer.isBuffer(buffer)
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Uint8Array.BYTES_PER_ELEMENT)
      : buffer
  }

  #enqueue<T>(operation: string, task: () => Promise<T>, mode: 'read' | 'write' = 'write'): Promise<T> {
    const result = new Promise<T>((resolve, reject) => {
      this.#queue.push({
        mode,
        run: async () => {
          try {
            resolve(await task())
          } catch (error) {
            const failure = new Error(
              `Store ${this.name} ${operation} failed: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
              { cause: error }
            )
            if (error instanceof Error) failure.name = error.name
            reject(failure)
          }
        }
      })
    })
    this.#drainQueue()
    return result
  }

  #drainQueue() {
    if (this.#activeWrite) return
    while (this.#queue[0]?.mode === 'read') this.#startRead(this.#queue.shift()!)
    if (this.#activeReads || !this.#queue.length) return

    const next = this.#queue.shift()!
    this.#activeWrite = true
    void next.run().finally(() => {
      this.#activeWrite = false
      this.#drainQueue()
    })
  }

  #startRead(task: { mode: 'read' | 'write'; run: () => Promise<void> }) {
    this.#activeReads++
    void task.run().finally(() => {
      this.#activeReads--
      this.#drainQueue()
    })
  }

  async #get(key: string | Uint8Array | KeyPath) {
    const value = await this.db.get(this.toKeyPath(key))
    if (value === undefined || value.length === 0)
      throw new DOMException(`Key not found: ${this.toKeyPath(key)}`, 'NotFoundError')
    return this.toUint8Array(value)
  }

  async #readAll<T>(reads: Promise<T>[]): Promise<T[]> {
    const results = await Promise.allSettled(reads)
    return results.map(result => {
      if (result.status === 'rejected') throw result.reason
      return result.value
    })
  }

  has(key: string | Uint8Array | KeyPath): Promise<boolean> {
    return this.#enqueue('has', async () => {
      try {
        await this.#get(key)
        return true
      } catch (error) {
        if (isNotFoundError(error)) return false
        throw error
      }
    }, 'read')
  }

  get(key: string | Uint8Array | KeyPath): Promise<Uint8Array> {
    return this.#enqueue('get', () => this.#get(key), 'read')
  }

  put(key: string | Uint8Array | KeyPath, value: string | Uint8Array | KeyValue): Promise<void> {
    return this.#enqueue('put', async () => this.db.put(this.toKeyPath(key), this.toKeyValue(value)))
  }

  delete(key: string | Uint8Array | KeyPath): Promise<void> {
    return this.#enqueue('delete', async () => this.db.del(this.toKeyPath(key)))
  }

  batch(operations: StorageBatchOperation[]): Promise<Uint8Array[]> {
    const mode = operations.every(operation => operation.type === undefined || operation.type === 'get') ? 'read' : 'write'
    return this.#enqueue('batch', async () => {
      const writes: ({ type: 'put'; key: string; value: Uint8Array } | { type: 'del'; key: string })[] = []
      const changes = new Map<string, Uint8Array | undefined>()
      const reads: Promise<Uint8Array>[] = []

      for (const operation of operations) {
        const key = this.toKeyPath(operation.key)
        if (operation.type === 'put') {
          const value = this.toKeyValue(operation.value)
          changes.set(key, value)
          writes.push({ type: 'put', key, value })
        } else if (operation.type === 'del' || operation.type === 'delete') {
          changes.set(key, undefined)
          writes.push({ type: 'del', key })
        } else if (changes.has(key)) {
          const value = changes.get(key)
          reads.push(value === undefined
            ? Promise.reject(new DOMException(`Key not found: ${key}`, 'NotFoundError'))
            : Promise.resolve(value))
        } else {
          reads.push(this.#get(operation.key))
        }
      }

      const results = await this.#readAll(reads)
      if (writes.length) await this.db.batch(writes)
      return results
    }, mode)
  }

  clear(): Promise<void> {
    return this.#enqueue('clear', async () => this.db.clear())
  }

  values(limit = -1): Promise<Uint8Array[]> {
    return this.#enqueue('values', async () => {
      const values: Uint8Array[] = []
      for await (const value of this.db.values({ limit })) values.push(this.toUint8Array(value))
      return values
    }, 'read')
  }

  keys(limit = -1): Promise<string[]> {
    return this.#enqueue('keys', async () => {
      const keys: string[] = []
      for await (const key of this.db.keys({ limit })) keys.push(key)
      return keys
    }, 'read')
  }

  size(): Promise<number> {
    return this.#enqueue('size', async () => {
      let size = 0
      for await (const [, value] of this.db.iterator()) size += value?.length ?? 0
      return size
    }, 'read')
  }

  iterate(options: IteratorOptions<string, Uint8Array> = {}): Promise<AsyncGenerator<[string, Uint8Array]>> {
    return this.#enqueue('iterate', async () => {
      const entries = await this.#readEntries(options)
      return (async function* () { yield* entries })()
    }, 'read')
  }

  entries(limit = -1): Promise<[string, Uint8Array][]> {
    return this.#enqueue('entries', () => this.#readEntries({ limit }), 'read')
  }

  async #readEntries(options: IteratorOptions<string, Uint8Array>): Promise<[string, Uint8Array][]> {
    const entries: [string, Uint8Array][] = []
    for await (const [key, value] of this.db.iterator(options))
      entries.push([key, this.toUint8Array(value)])
    return entries
  }
}
