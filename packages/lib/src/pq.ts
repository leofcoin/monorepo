/** Private disposable chains only. This is not a MultiWallet wire format. */
import { ml_dsa87 } from '@noble/post-quantum/ml-dsa.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256, sha512 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { assertChainId } from './chain-identity.js'

export const PQ_NETWORK = 'leofcoin:pq'
export const PQ_SCHEME = 'ML-DSA-87:v1'
export const PQ_ADDRESS_PREFIX = 'lfc-pq1:'
export const PQ_PUBLIC_KEY_BYTES = 2592
export const PQ_SIGNATURE_BYTES = 4627
const utf8 = new TextEncoder()

export function pqAddress(publicKey: Uint8Array): string {
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== PQ_PUBLIC_KEY_BYTES)
    throw new Error('Invalid ML-DSA-87 public key length')
  return PQ_ADDRESS_PREFIX + bytesToHex(publicKey)
}

export function pqPublicKey(address: string): Uint8Array {
  if (typeof address !== 'string' || address.length !== PQ_ADDRESS_PREFIX.length + PQ_PUBLIC_KEY_BYTES * 2 ||
    !address.startsWith(PQ_ADDRESS_PREFIX) || !/^[0-9a-f]+$/.test(address.slice(PQ_ADDRESS_PREFIX.length)))
    throw new Error('Invalid canonical PQ address')
  return hexToBytes(address.slice(PQ_ADDRESS_PREFIX.length))
}

function context(chainId: string): Uint8Array {
  return utf8.encode(`Leofcoin:ML-DSA-87:v1:${assertChainId(chainId)}`)
}

export function verifyPqDigest(address: string, signature: Uint8Array, digest: Uint8Array, chainId: string): boolean {
  try {
    if (!(digest instanceof Uint8Array) || digest.length !== 32 ||
      !(signature instanceof Uint8Array) || signature.length !== PQ_SIGNATURE_BYTES) return false
    return ml_dsa87.verify(signature, digest, pqPublicKey(address), { context: context(chainId) })
  } catch { return false }
}

/** Volatile seed-recoverable provider. No secret is written to Peernet's stores. */
export class PqIdentity {
  readonly network = PQ_NETWORK
  readonly scheme = PQ_SCHEME
  readonly id: string
  readonly selectedAccount: string
  #secret: Uint8Array | undefined
  #chainId?: string

  constructor(seed: Uint8Array, network = PQ_NETWORK, accountIndex = 0) {
    if (network !== PQ_NETWORK) throw new Error('PQ identity requires leofcoin:pq')
    if (!(seed instanceof Uint8Array) || seed.length !== 64) throw new Error('A 64-byte BIP39 seed is required')
    if (!Number.isSafeInteger(accountIndex) || accountIndex < 0 || accountIndex > 0xffffffff)
      throw new Error('Account index must be uint32')
    // UTF-8 namespace, NUL delimiter, canonical decimal uint32. Never platform-endian.
    const derived = hkdf(sha512, seed, utf8.encode('leofcoin:ML-DSA-87:v1'),
      utf8.encode(`${network}\0${accountIndex}`), 32)
    try {
      const { publicKey, secretKey } = ml_dsa87.keygen(derived)
      this.#secret = secretKey
      this.selectedAccount = pqAddress(publicKey)
      this.id = 'lfc-pq-id-v1-' + bytesToHex(sha256(publicKey))
    } finally { derived.fill(0) }
    Object.freeze(this)
  }

  get address() { return Promise.resolve(this.selectedAccount) }
  get accounts(): Promise<Array<[string, string, string]>> {
    return Promise.resolve([['PQ account', this.selectedAccount, this.selectedAccount]])
  }
  getAccounts() { return this.accounts }
  async load(_password?: string, fresh = false) {
    if (fresh) throw new Error('PQ identities must be explicitly recovered from a caller-supplied seed')
    if (!this.#secret) throw new Error('PQ identity has been destroyed')
  }
  bindChainId(chainId: string) {
    assertChainId(chainId)
    if (this.#chainId && this.#chainId !== chainId) throw new Error('PQ identity is already bound to another chain')
    this.#chainId = chainId
  }
  async selectAccount(address: string) {
    if (address !== this.selectedAccount) throw new Error('Unknown PQ account; recover its explicit account index')
  }
  async sign(digest: Uint8Array): Promise<Uint8Array> {
    if (!this.#secret || !this.#chainId) throw new Error('PQ identity requires a live key and validated chain binding')
    if (!(digest instanceof Uint8Array) || digest.length !== 32) throw new Error('PQ signing requires a 32-byte digest')
    return ml_dsa87.sign(digest, this.#secret, { context: context(this.#chainId) })
  }
  destroy() { this.#secret?.fill(0); this.#secret = undefined }
  export(): never { throw new Error('Volatile PQ provider: recover using the original BIP39 seed and account index') }
  import(): never { throw new Error('Construct a new PQ provider from the original BIP39 seed') }
  lock(): never { throw new Error('Volatile PQ provider: use destroy(), then seed-based recovery') }
  unlock(): never { throw new Error('Recover a new PQ provider from the original BIP39 seed') }
}
