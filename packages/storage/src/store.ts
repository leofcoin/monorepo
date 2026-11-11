import { join } from 'path'
import { init } from './utils.js'
import KeyPath from './path.js'
import KeyValue from './value.js'
import { isNotFoundError } from './utils.js'
import { ClassicLevel, type IteratorOptions } from 'classic-level'

export default class Store {
  db!: ClassicLevel<string, Uint8Array>
  name!: string
  root!: string
  version!: number

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

  async has(key: KeyPath) {
    try {
      await this.get(key)
      return true
    } catch (error) {
      if (isNotFoundError(error)) return false
      throw error
    }
  }

  async get(key: KeyPath) {
    const value = await this.db.get(this.toKeyPath(key))
    if (value === undefined || value.length === 0) {
      throw new DOMException(`Key not found: ${this.toKeyPath(key)}`, 'NotFoundError')
    }
    return this.toUint8Array(value)
  }

  async put(key: KeyPath, value: KeyValue) {
    return this.db.put(this.toKeyPath(key), this.toKeyValue(value))
  }

  async delete(key: KeyPath) {
    return this.db.del(this.toKeyPath(key))
  }

  async clear() {
    return this.db.clear()
  }

  async values(limit = -1) {
    const values: Uint8Array[] = []
    for await (const value of this.db.values({ limit })) {
      values.push(this.toUint8Array(value))
    }
    return values
  }

  async keys(limit = -1) {
    const keys: string[] = []
    for await (const key of this.db.keys({ limit })) {
      keys.push(key)
    }
    return keys
  }

  async size() {
    let size = 0
    for await (const [, value] of this.db.iterator()) {
      size += value?.length ?? 0
    }
    return size
  }

  iterate(options: IteratorOptions<string, Uint8Array> = {}) {
    return this.db.iterator(options)
  }

  async entries(limit = -1): Promise<[string, Uint8Array][]> {
    const entries: [string, Uint8Array][] = []
    for await (const [key, value] of this.db.iterator({ limit })) {
      entries.push([key, this.toUint8Array(value)])
    }
    return entries
  }
}
