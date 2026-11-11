import { join } from 'path'
import { init, isNotFoundError } from './utils.js'
import KeyPath from './path.js'
import KeyValue from './value.js'
import { ClassicLevel, type IteratorOptions } from 'classic-level'

export default class Store {
  db!: ClassicLevel<string, Uint8Array>
  name!: string
  root!: string
  version!: number
  #busy = false
  #queue: (() => Promise<void>)[] = []

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

  #enqueue<T>(operation: string, task: () => Promise<T>): Promise<T> {
    const result = new Promise<T>((resolve, reject) => {
      this.#queue.push(async () => {
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
      })
    })
    void this.#runQueue()
    return result
  }

  async #runQueue() {
    if (this.#busy) return
    this.#busy = true
    try {
      for (let next = this.#queue.shift(); next; next = this.#queue.shift()) await next()
    } finally {
      this.#busy = false
      if (this.#queue.length) void this.#runQueue()
    }
  }

  async #get(key: KeyPath) {
    const value = await this.db.get(this.toKeyPath(key))
    if (value === undefined || value.length === 0)
      throw new DOMException(`Key not found: ${this.toKeyPath(key)}`, 'NotFoundError')
    return this.toUint8Array(value)
  }

  has(key: KeyPath): Promise<boolean> {
    return this.#enqueue('has', async () => {
      try {
        await this.#get(key)
        return true
      } catch (error) {
        if (isNotFoundError(error)) return false
        throw error
      }
    })
  }

  get(key: KeyPath): Promise<Uint8Array> {
    return this.#enqueue('get', () => this.#get(key))
  }

  put(key: KeyPath, value: KeyValue): Promise<void> {
    return this.#enqueue('put', async () => this.db.put(this.toKeyPath(key), this.toKeyValue(value)))
  }

  delete(key: KeyPath): Promise<void> {
    return this.#enqueue('delete', async () => this.db.del(this.toKeyPath(key)))
  }

  clear(): Promise<void> {
    return this.#enqueue('clear', async () => this.db.clear())
  }

  values(limit = -1): Promise<Uint8Array[]> {
    return this.#enqueue('values', async () => {
      const values: Uint8Array[] = []
      for await (const value of this.db.values({ limit })) values.push(this.toUint8Array(value))
      return values
    })
  }

  keys(limit = -1): Promise<string[]> {
    return this.#enqueue('keys', async () => {
      const keys: string[] = []
      for await (const key of this.db.keys({ limit })) keys.push(key)
      return keys
    })
  }

  size(): Promise<number> {
    return this.#enqueue('size', async () => {
      let size = 0
      for await (const [, value] of this.db.iterator()) size += value?.length ?? 0
      return size
    })
  }

  iterate(options: IteratorOptions<string, Uint8Array> = {}): Promise<AsyncGenerator<[string, Uint8Array]>> {
    return this.#enqueue('iterate', async () => {
      const entries = await this.#readEntries(options)
      return (async function* () { yield* entries })()
    })
  }

  entries(limit = -1): Promise<[string, Uint8Array][]> {
    return this.#enqueue('entries', () => this.#readEntries({ limit }))
  }

  async #readEntries(options: IteratorOptions<string, Uint8Array>): Promise<[string, Uint8Array][]> {
    const entries: [string, Uint8Array][] = []
    for await (const [key, value] of this.db.iterator(options))
      entries.push([key, this.toUint8Array(value)])
    return entries
  }
}
