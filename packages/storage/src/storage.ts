import type BrowserStore from './browser-store.js'
import Path from './path.js'
import type Store from './store.js'
import { isBrowser, isNotFoundError } from './utils.js'
import KeyValue from './value.js'

type KeyInput = string | Uint8Array | Path
type ValueInput = string | Uint8Array | KeyValue
type WriteResult = void | boolean

export type DefaultOptions = {
  inWorker: boolean
  version: number
  homedir: boolean
}

const defaultOptions: DefaultOptions = {
  inWorker: false,
  version: 1,
  homedir: true
}

export default class LeofcoinStorage {
  name: string
  root: string
  version: number
  inWorker: boolean
  homedir: boolean
  db!: Store | BrowserStore

  constructor(name = 'storage', root = '.leofcoin', options: Partial<DefaultOptions> = {}) {
    const { version, inWorker, homedir } = { ...defaultOptions, ...options }
    this.name = name
    this.root = root
    this.version = version || 1
    this.inWorker = inWorker
    this.homedir = homedir
  }

  async init() {
    const importee = await import(isBrowser ? './browser-store.js' : './store.js')
    this.db = new importee.default()
    await this.db.init(this.name, this.root, this.version, this.inWorker, this.homedir)
  }

  get(key: KeyInput): Promise<Uint8Array>
  get(keys: KeyInput[]): Promise<Uint8Array[]>
  async get(key: KeyInput | KeyInput[]): Promise<Uint8Array | Uint8Array[]> {
    if (Array.isArray(key)) return this.many('get', key)
    return this.db.get(new Path(key).uint8Array)
  }

  put(key: KeyInput, value: ValueInput): Promise<WriteResult>
  put(values: Record<string, ValueInput>): Promise<WriteResult[]>
  async put(key: KeyInput | Record<string, ValueInput>, value?: ValueInput): Promise<WriteResult | WriteResult[]> {
    if (typeof key !== 'string' && !(key instanceof Uint8Array) && !(key instanceof Path))
      return this.many('put', key)
    if (value === undefined) throw new Error('A storage value is required')
    return this.db.put(new Path(key).uint8Array, new KeyValue(value).uint8Array)
  }

  has(key: KeyInput): Promise<boolean>
  has(keys: KeyInput[]): Promise<boolean[]>
  async has(key: KeyInput | KeyInput[]): Promise<boolean | boolean[]> {
    if (Array.isArray(key)) return this.many('has', key)
    return Boolean(await this.db.has(new Path(key).uint8Array))
  }

  hasValue(key: KeyInput): Promise<boolean>
  hasValue(keys: KeyInput[]): Promise<boolean[]>
  async hasValue(key: KeyInput | KeyInput[]): Promise<boolean | boolean[]> {
    if (Array.isArray(key)) return this.many('hasValue', key)
    try {
      const value = await this.get(key)
      return value !== undefined && value.length > 0
    } catch (error) {
      if (!isNotFoundError(error)) throw error
      return false
    }
  }

  async delete(key: KeyInput) {
    return this.db.delete(new Path(key).uint8Array)
  }

  keys(limit = -1) {
    return this.db.keys(limit)
  }

  async values(limit = -1) {
    return this.db.values(limit)
  }

  many(type: 'get', keys: KeyInput[]): Promise<Uint8Array[]>
  many(type: 'has' | 'hasValue', keys: KeyInput[]): Promise<boolean[]>
  many(type: 'delete', keys: KeyInput[]): Promise<WriteResult[]>
  many(type: 'put', values: Record<string, ValueInput>): Promise<WriteResult[]>
  async many(type: 'get' | 'has' | 'hasValue' | 'delete' | 'put', value: KeyInput[] | Record<string, ValueInput>) {
    if (type === 'put') {
      if (Array.isArray(value)) throw new Error('Batch writes require a key/value record')
      return Promise.all(Object.entries(value).map(([key, bytes]) => this.put(key, bytes)))
    }
    if (!Array.isArray(value)) throw new Error('Batch reads and deletes require an array of keys')
    return Promise.all(value.map(key => this[type](key)))
  }

  async length() {
    return (await this.keys()).length
  }

  size() {
    return this.db.size()
  }

  async clear() {
    return this.db.clear()
  }

  async iterate() {
    return this.db.iterate()
  }

  entries(limit = -1): Promise<[string, Uint8Array][]> {
    return this.db.entries(limit)
  }
}

export { LeofcoinStorage as Storage }
