import KeyPath from './path.js'
import KeyValue from './value.js'
import { isNotFoundError } from './utils.js'
import { createDebugger } from '@vandeurenglenn/debug'

export type KeyInput = string | Uint8Array | KeyPath
export type ValueInput = string | Uint8Array | KeyValue

interface SyncAccessHandle {
  getSize(): number
  read(buffer: Uint8Array, options: { at: number }): number
  write(buffer: Uint8Array): number
  close(): void
}

const supportsSyncAccess = (file: FileSystemFileHandle): file is FileSystemFileHandle & {
  createSyncAccessHandle(): Promise<SyncAccessHandle>
} => 'createSyncAccessHandle' in file && typeof file.createSyncAccessHandle === 'function'

const debug = createDebugger('leofcoin/storage')
const opfsRoot = await navigator.storage.getDirectory()

export default class BrowserStore {
  db!: FileSystemDirectoryHandle
  name = 'storage'
  root!: FileSystemDirectoryHandle
  inWorker = false
  version = 1
  #busy = false
  #queue: (() => Promise<void>)[] = []

  async init(name = 'storage', root = '.leofcoin', version = 1, inWorker = false, homedir = true) {
    this.version = version
    this.name = name
    this.root = opfsRoot
    this.inWorker = inWorker
    this.db = await opfsRoot.getDirectoryHandle(this.name, { create: true })
  }

  toKeyPath(key: KeyInput) {
    return new KeyPath(key).toString()
  }

  toKeyValue(value: ValueInput) {
    return new KeyValue(value).uint8Array
  }

  #enqueue<T>(operation: string, task: () => Promise<T>): Promise<T> {
    const result = new Promise<T>((resolve, reject) => {
      this.#queue.push(async () => {
        try {
          resolve(await task())
        } catch (error) {
          const failure = new Error(
            `Browser store ${this.name} ${operation} failed: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
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
      for (let next = this.#queue.shift(); next; next = this.#queue.shift()) {
        await next()
      }
    } finally {
      this.#busy = false
      if (this.#queue.length) void this.#runQueue()
    }
  }

  has(key: KeyInput): Promise<boolean> {
    return this.#enqueue('has', async () => {
      const path = this.toKeyPath(key)
      debug(`has ${path}`)
      try {
        await this.db.getFileHandle(path)
        return true
      } catch (error) {
        if (isNotFoundError(error)) return false
        throw error
      }
    })
  }

  get(key: KeyInput): Promise<Uint8Array> {
    return this.#enqueue('get', async () => {
      debug(`get ${this.toKeyPath(key)}`)
      const file = await this.db.getFileHandle(this.toKeyPath(key))
      if (this.inWorker) {
        if (!supportsSyncAccess(file)) throw new Error('Synchronous OPFS access is unavailable')
        const handle = await file.createSyncAccessHandle()
        try {
          const bytes = new Uint8Array(handle.getSize())
          const read = handle.read(bytes, { at: 0 })
          return bytes.subarray(0, read)
        } finally {
          handle.close()
        }
      }
      return new Uint8Array(await (await file.getFile()).arrayBuffer())
    })
  }

  put(key: KeyInput, value: ValueInput) {
    return this.#enqueue('put', async () => {
      debug(`put ${this.toKeyPath(key)}`)
      const file = await this.db.getFileHandle(this.toKeyPath(key), { create: true })
      const bytes = this.toKeyValue(value)
      if (this.inWorker) {
        if (!supportsSyncAccess(file)) throw new Error('Synchronous OPFS access is unavailable')
        const handle = await file.createSyncAccessHandle()
        try {
          if (handle.write(bytes) !== bytes.length) throw new Error('Incomplete OPFS write')
        } finally {
          handle.close()
        }
      } else {
        const writable = await file.createWritable()
        await writable.write(Uint8Array.from(bytes))
        await writable.close()
      }
      return true
    })
  }

  delete(key: KeyInput) {
    return this.#enqueue('delete', async () => this.#deleteFile(this.toKeyPath(key)))
  }

  async #deleteFile(path: string): Promise<boolean> {
    let lastError: unknown
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await this.db.getFileHandle(`${path}.crswap`)
        lastError = new Error(`Temporary write for ${path} is still active`)
      } catch (error) {
        if (!isNotFoundError(error)) throw error
        try {
          await this.db.removeEntry(path)
          return true
        } catch (error) {
          if (isNotFoundError(error)) return false
          if (!(error instanceof Error) || error.name !== 'NoModificationAllowedError') throw error
          lastError = error
        }
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(5 * 2 ** attempt, 100)))
    }
    throw lastError ?? new Error(`Could not delete ${path}`)
  }

  clear(): Promise<void> {
    return this.#enqueue('clear', async () => {
      for await (const key of this.db.keys()) {
        debug(`clear ${key}`)
        await this.#deleteFile(key)
      }
    })
  }

  async #readAll<T>(reads: Promise<T>[]): Promise<T[]> {
    const results = await Promise.allSettled(reads)
    return results.map(result => {
      if (result.status === 'rejected') throw result.reason
      return result.value
    })
  }

  values(limit = -1): Promise<Uint8Array[]> {
    return this.#enqueue('values', async () => {
      if (limit === 0) return []
      const files: FileSystemFileHandle[] = []
      for await (const cursor of this.db.values()) {
        if (cursor.kind !== 'file') throw new Error(`Unexpected directory in store ${this.name}`)
        files.push(cursor)
        if (limit >= 0 && files.length >= limit) break
      }
      return this.#readAll(files.map(async file => new Uint8Array(await (await file.getFile()).arrayBuffer())))
    })
  }

  size(): Promise<number> {
    return this.#enqueue('size', async () => {
      let size = 0
      for await (const cursor of this.db.values()) {
        if (cursor.kind !== 'file') throw new Error(`Unexpected directory in store ${this.name}`)
        size += (await cursor.getFile()).size
      }
      return size
    })
  }

  keys(limit = -1): Promise<string[]> {
    return this.#enqueue('keys', async () => {
      if (limit === 0) return []
      const keys: string[] = []
      for await (const key of this.db.keys()) {
        keys.push(key)
        if (limit >= 0 && keys.length >= limit) break
      }
      return keys
    })
  }

  async iterate(): Promise<AsyncGenerator<[string, Uint8Array]>> {
    const snapshot = await this.#enqueue('iterate', () => this.#snapshotEntries())
    return (async function* () { yield* snapshot })()
  }

  entries(limit = -1): Promise<[string, Uint8Array][]> {
    return this.#enqueue('entries', () => this.#snapshotEntries(limit))
  }

  async #snapshotEntries(limit = -1): Promise<[string, Uint8Array][]> {
    if (limit === 0) return []
    const files: [string, FileSystemFileHandle][] = []
    for await (const [key, cursor] of this.db.entries()) {
      if (cursor.kind !== 'file') throw new Error(`Unexpected directory in store ${this.name}`)
      files.push([key, cursor])
      if (limit >= 0 && files.length >= limit) break
    }
    return this.#readAll(files.map(async ([key, file]): Promise<[string, Uint8Array]> =>
      [key, new Uint8Array(await (await file.getFile()).arrayBuffer())]))
  }
}
