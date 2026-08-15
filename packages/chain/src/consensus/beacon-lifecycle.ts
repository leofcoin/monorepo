import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'

import {
  beaconEpochDigest,
  canonicalBeaconEpochConfig,
  type BeaconActivationVote,
  type BeaconEpochConfig
} from './beacon-epoch.ts'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const PRIVATE_PREFIX = 'beacon/private/'
const PUBLIC_PREFIX = 'beacon/public/'

type Store = {
  delete(key: string): Promise<unknown>
  get(key: string): Promise<unknown>
  has(key: string): Promise<boolean>
  keys(): Promise<string[]>
  put(key: string, value: Uint8Array | string): Promise<unknown>
}

export type ActiveBeaconEpoch = {
  certificate: BeaconActivationVote[]
  config: BeaconEpochConfig
}

export type PrivateBeaconEpoch = {
  encryptionPrivateKey: string
  epoch: bigint
  secretShare: string
}

type SealedRecord = {
  ciphertext: number[]
  nonce: number[]
  version: 1
}

const parse = (value: unknown) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer)
  return JSON.parse(decoder.decode(bytes))
}

const stringify = (value: unknown) =>
  encoder.encode(JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? `${item}n` : item)))

const revive = (value: unknown) => {
  if (Array.isArray(value)) return value.map(revive)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item)]))
  }
  if (typeof value === 'string' && /^\d+n$/.test(value)) return BigInt(value.slice(0, -1))
  return value
}

const storageKey = (prefix: string, network: string, epoch: bigint) => `${prefix}${network}/${epoch}`

const sealingContext = (network: string, validator: string) =>
  encoder.encode(`leofcoin-beacon-storage-v1:${network}:${validator}`)

const sealingKey = async (network: string, validator: string, sign: (bytes: Uint8Array) => Promise<Uint8Array>) => {
  const context = sealingContext(network, validator)
  const signature = await sign(sha256(context))
  return hkdf(sha256, signature, sha256(context), context, 32)
}

const aesKey = (raw: Uint8Array, usage: KeyUsage) =>
  globalThis.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [usage])

const validateCertificate = (config: BeaconEpochConfig, certificate: BeaconActivationVote[]) => {
  const digest = beaconEpochDigest(config)
  const voters = new Set<string>()
  for (const vote of certificate) {
    if (
      vote.epoch !== config.epoch ||
      vote.configDigest !== digest ||
      !config.validators.includes(vote.from) ||
      !vote.signature ||
      voters.has(vote.from)
    )
      throw new Error('invalid beacon epoch certificate')
    voters.add(vote.from)
  }
  if (voters.size < config.threshold) throw new Error('beacon epoch certificate is below threshold')
}

export const persistPublicBeaconEpoch = async (store: Store, network: string, active: ActiveBeaconEpoch) => {
  const config = canonicalBeaconEpochConfig(active.config)
  validateCertificate(config, active.certificate)
  await store.put(
    storageKey(PUBLIC_PREFIX, network, config.epoch),
    stringify({ config, certificate: active.certificate })
  )
}

export const loadPublicBeaconEpoch = async (
  store: Store,
  network: string,
  epoch: bigint
): Promise<ActiveBeaconEpoch | undefined> => {
  const key = storageKey(PUBLIC_PREFIX, network, epoch)
  if (!(await store.has(key))) return undefined
  const active = revive(parse(await store.get(key))) as ActiveBeaconEpoch
  const config = canonicalBeaconEpochConfig(active.config)
  validateCertificate(config, active.certificate)
  return { config, certificate: active.certificate }
}

export const persistPrivateBeaconEpoch = async (
  store: Store,
  network: string,
  validator: string,
  record: PrivateBeaconEpoch,
  sign: (bytes: Uint8Array) => Promise<Uint8Array>,
  randomNonce = () => globalThis.crypto.getRandomValues(new Uint8Array(12))
) => {
  const nonce = randomNonce()
  if (nonce.length !== 12) throw new Error('beacon storage nonce must contain 12 bytes')
  const context = sealingContext(network, validator)
  const key = await aesKey(await sealingKey(network, validator, sign), 'encrypt')
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: context, tagLength: 128 },
    key,
    stringify(record)
  )
  const sealed: SealedRecord = { version: 1, nonce: [...nonce], ciphertext: [...new Uint8Array(ciphertext)] }
  await store.put(storageKey(PRIVATE_PREFIX, network, record.epoch), stringify(sealed))
}

export const loadPrivateBeaconEpoch = async (
  store: Store,
  network: string,
  validator: string,
  epoch: bigint,
  sign: (bytes: Uint8Array) => Promise<Uint8Array>
): Promise<PrivateBeaconEpoch | undefined> => {
  const storage = storageKey(PRIVATE_PREFIX, network, epoch)
  if (!(await store.has(storage))) return undefined
  const sealed = parse(await store.get(storage)) as SealedRecord
  if (sealed.version !== 1 || sealed.nonce.length !== 12 || sealed.ciphertext.length < 17) {
    throw new Error('invalid sealed beacon epoch record')
  }
  const context = sealingContext(network, validator)
  const key = await aesKey(await sealingKey(network, validator, sign), 'decrypt')
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(sealed.nonce), additionalData: context, tagLength: 128 },
    key,
    new Uint8Array(sealed.ciphertext)
  )
  const record = revive(parse(new Uint8Array(plaintext))) as PrivateBeaconEpoch
  if (record.epoch !== epoch) throw new Error('sealed beacon epoch does not match its storage key')
  return record
}

export const clearBeaconEpochStorage = async (stores: Store[], network: string) => {
  for (const store of stores) {
    for (const key of await store.keys()) {
      if (key.startsWith(`${PRIVATE_PREFIX}${network}/`) || key.startsWith(`${PUBLIC_PREFIX}${network}/`)) {
        await store.delete(key)
      }
    }
  }
}

/** Height-driven lifecycle. Failed future ceremonies never replace the last active key. */
export class BeaconLifecycle {
  readonly epochLength: number
  #active?: ActiveBeaconEpoch
  #pending = new Map<bigint, ActiveBeaconEpoch>()

  constructor(epochLength: number) {
    if (!Number.isSafeInteger(epochLength) || epochLength < 2)
      throw new RangeError('beacon epoch length must be at least 2')
    this.epochLength = epochLength
  }

  epochAtHeight(height: number): bigint {
    if (!Number.isSafeInteger(height) || height < 0) throw new RangeError('invalid block height')
    return BigInt(Math.floor(height / this.epochLength))
  }

  ceremonyEpoch(height: number): bigint {
    return this.epochAtHeight(height) + 1n
  }

  stage(active: ActiveBeaconEpoch) {
    const config = canonicalBeaconEpochConfig(active.config)
    validateCertificate(config, active.certificate)
    this.#pending.set(config.epoch, { config, certificate: [...active.certificate] })
  }

  restore(active: ActiveBeaconEpoch) {
    const config = canonicalBeaconEpochConfig(active.config)
    validateCertificate(config, active.certificate)
    this.#active = { config, certificate: [...active.certificate] }
  }

  advance(height: number): ActiveBeaconEpoch | undefined {
    const epoch = this.epochAtHeight(height)
    const pending = this.#pending.get(epoch)
    if (pending) {
      this.#active = pending
      this.#pending.delete(epoch)
    }
    return this.#active
  }

  get active(): ActiveBeaconEpoch | undefined {
    return this.#active
  }
}

const storedEpochs = async (store: Store, prefix: string, network: string): Promise<bigint[]> => {
  const scoped = `${prefix}${network}/`
  return (await store.keys())
    .filter((key) => key.startsWith(scoped))
    .map((key) => key.slice(scoped.length))
    .filter((epoch) => /^\d+$/.test(epoch))
    .map(BigInt)
    .sort((left, right) => (left > right ? -1 : left < right ? 1 : 0))
}

export const restoreBeaconLifecycle = async (
  publicStore: Store,
  privateStore: Store,
  network: string,
  validator: string,
  height: number,
  epochLength: number,
  sign: (bytes: Uint8Array) => Promise<Uint8Array>
): Promise<{ lifecycle: BeaconLifecycle; privateEpoch?: PrivateBeaconEpoch }> => {
  const lifecycle = new BeaconLifecycle(epochLength)
  const currentEpoch = lifecycle.epochAtHeight(height)
  const epochs = await storedEpochs(publicStore, PUBLIC_PREFIX, network)
  const activeEpoch = epochs.find((epoch) => epoch <= currentEpoch)
  if (activeEpoch === undefined) return { lifecycle }

  const active = await loadPublicBeaconEpoch(publicStore, network, activeEpoch)
  if (!active) throw new Error('beacon public epoch disappeared during restore')
  lifecycle.restore(active)
  const privateEpoch = await loadPrivateBeaconEpoch(privateStore, network, validator, activeEpoch, sign)
  return privateEpoch ? { lifecycle, privateEpoch } : { lifecycle }
}
