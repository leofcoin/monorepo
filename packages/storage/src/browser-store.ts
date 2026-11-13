import KeyPath from './path.js'
import KeyValue from './value.js'
import { isNotFoundError } from './utils.js'
import { createDebugger } from '@vandeurenglenn/debug'
import type { StorageBatchOperation } from './storage.js'

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
  #activeReads = 0
  #activeWrite = false
  #queue: { mode: 'read' | 'write'; run: () => Promise<void> }[] = []
  #syncReadTails = new Map<string, Promise<void>>()

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

  #enqueue<T>(operation: string, task: () => Promise<T>, mode: 'read' | 'write' = 'write'): Promise<T> {
    const result = new Promise<T>((resolve, reject) => {
      this.#queue.push({
        mode,
        run: async () => {
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
        }
      })
    })
    this.#drainQueue()
    return result
  }

  #drainQueue() {
    if (this.#activeWrite) return
    // Reads may overlap, but never pass a queued write.
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
    }, 'read')
  }

  get(key: KeyInput): Promise<Uint8Array> {
    return this.#enqueue('get', () => this.#get(key), 'read')
  }

  async #get(key: KeyInput): Promise<Uint8Array> {
    const path = this.toKeyPath(key)
    debug(`get ${path}`)
    const file = await this.db.getFileHandle(path)
    if (this.inWorker) {
      return this.#withSyncReadLock(path, async () => {
        if (!supportsSyncAccess(file)) throw new Error('Synchronous OPFS access is unavailable')
        const handle = await file.createSyncAccessHandle()
        try {
          const bytes = new Uint8Array(handle.getSize())
          const read = handle.read(bytes, { at: 0 })
          return bytes.subarray(0, read)
        } finally {
          handle.close()
        }
      })
    }
    return new Uint8Array(await (await file.getFile()).arrayBuffer())
  }

  async #withSyncReadLock<T>(path: string, read: () => Promise<T>): Promise<T> {
    const previous = this.#syncReadTails.get(path) ?? Promise.resolve()
    let release!: () => void
    const hold = new Promise<void>(resolve => { release = resolve })
    const tail = previous.then(() => hold)
    this.#syncReadTails.set(path, tail)
    await previous
    try {
      return await read()
    } finally {
      release()
      if (this.#syncReadTails.get(path) === tail) this.#syncReadTails.delete(path)
    }
  }

  put(key: KeyInput, value: ValueInput) {
    return this.#enqueue('put', () => this.#put(key, value))
  }

  async #put(key: KeyInput, value: ValueInput) {
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
  }

  batch(operations: StorageBatchOperation[]): Promise<Uint8Array[]> {
    const mode = operations.every(operation => operation.type === undefined || operation.type === 'get') ? 'read' : 'write'
    return this.#enqueue('batch', async () => {
      const writes: ({ type: 'put'; key: KeyInput; value: ValueInput } | { type: 'del' | 'delete'; key: KeyInput })[] = []
      const changes = new Map<string, Uint8Array | undefined>()
      const reads: Promise<Uint8Array>[] = []

      for (const operation of operations) {
        const path = this.toKeyPath(operation.key)
        if (operation.type === 'put') {
          const value = this.toKeyValue(operation.value)
          changes.set(path, value)
          writes.push({ type: 'put', key: operation.key, value })
        } else if (operation.type === 'del' || operation.type === 'delete') {
          changes.set(path, undefined)
          writes.push({ type: operation.type, key: operation.key })
        } else if (changes.has(path)) {
          const value = changes.get(path)
          reads.push(value === undefined
            ? Promise.reject(new DOMException(`Key not found: ${path}`, 'NotFoundError'))
            : Promise.resolve(value))
        } else {
          reads.push(this.#get(operation.key))
        }
      }

      const results = await this.#readAll(reads)
      for (const operation of writes) {
        if (operation.type === 'put') await this.#put(operation.key, operation.value)
        else await this.#deleteFile(this.toKeyPath(operation.key))
      }
      return results
    }, mode)
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
    }, 'read')
  }

  size(): Promise<number> {
    return this.#enqueue('size', async () => {
      let size = 0
      for await (const cursor of this.db.values()) {
        if (cursor.kind !== 'file') throw new Error(`Unexpected directory in store ${this.name}`)
        size += (await cursor.getFile()).size
      }
      return size
    }, 'read')
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
    }, 'read')
  }

  async iterate(): Promise<AsyncGenerator<[string, Uint8Array]>> {
    const snapshot = await this.#enqueue('iterate', () => this.#snapshotEntries(), 'read')
    return (async function* () { yield* snapshot })()
  }

  entries(limit = -1): Promise<[string, Uint8Array][]> {
    return this.#enqueue('entries', () => this.#snapshotEntries(limit), 'read')
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
