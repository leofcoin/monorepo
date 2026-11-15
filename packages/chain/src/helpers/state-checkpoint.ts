import { BlockMessage } from '@leofcoin/messages'
import { jsonParseBigInt, jsonStringifyBigInt } from '@leofcoin/utils'
import { validateChainLink } from '../consensus/chain-link.js'
import type { ChainTip } from '../consensus/chain-link.js'
import type { Storage } from '@leofcoin/storage'

export const CHECKPOINT_KEYS = ['checkpoint:0', 'checkpoint:1']
const counters = ['nativeCalls', 'nativeMints', 'nativeBurns', 'nativeTransfers', 'totalBurnAmount',
  'totalMintAmount', 'totalTransferAmount', 'totalTransactions', 'totalBlocks'] as const
export type CheckpointSnapshot = {
  chainId: string
  states: Record<string, unknown>
  accounts: Record<string, string>
  info: Record<(typeof counters)[number], bigint>
  lastBlock: { index: number | bigint; hash: string }
}
export type Checkpoint = { generation: number; snapshot: CheckpointSnapshot }
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: string | Uint8Array) =>
  typeof value === 'string' ? value : new TextDecoder('utf-8', { fatal: true }).decode(value)
const digest = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('')

export function validateCheckpoint(snapshot: unknown, chainId: string, requiredContracts: string[]): CheckpointSnapshot {
  if (!record(snapshot) || snapshot.chainId !== chainId || !record(snapshot.states) || !record(snapshot.accounts) || !record(snapshot.info))
    throw new Error('Invalid checkpoint or chain identity')
  const tip = snapshot.lastBlock
  if (!record(tip)) throw new Error('Invalid checkpoint tip')
  const index = Number(tip?.index)
  if (!['bigint', 'number'].includes(typeof tip?.index) || !Number.isSafeInteger(index) || index < -1 ||
    (index === -1 ? tip.hash !== '0x0' : typeof tip.hash !== 'string' || !tip.hash || tip.hash === '0x0'))
    throw new Error('Invalid checkpoint tip')
  for (const contract of requiredContracts) if (!record(snapshot.states[contract])) throw new Error(`Incomplete checkpoint contract: ${contract}`)
  for (const [address, nonce] of Object.entries(snapshot.accounts))
    if (!address || typeof nonce !== 'string' || !/^(0|[1-9]\d*)$/.test(nonce)) throw new Error('Invalid checkpoint nonce')
  for (const counter of counters) {
    const value = snapshot.info[counter]
    if (typeof value !== 'bigint' || value < 0n) throw new Error(`Invalid checkpoint counter: ${counter}`)
  }
  if (snapshot.info.totalBlocks !== BigInt(index) + 1n) throw new Error('Checkpoint block count does not match tip')
  return snapshot as CheckpointSnapshot
}

/** Alternate complete records: a torn write never destroys the previous slot. */
export async function writeCheckpoint(store: Storage, snapshot: CheckpointSnapshot, generation: number, requiredContracts: string[]) {
  if (!Number.isSafeInteger(generation) || generation < 0) throw new Error('Invalid checkpoint generation')
  validateCheckpoint(snapshot, snapshot.chainId, requiredContracts)
  const payload = JSON.stringify({ generation, snapshot }, jsonStringifyBigInt)
  await store.put(CHECKPOINT_KEYS[generation % 2], new TextEncoder().encode(JSON.stringify({ schema: 1, payload, checksum: await digest(payload) })))
}

export async function readCheckpoint(store: Storage, chainId: string, requiredContracts: string[]): Promise<Checkpoint | undefined> {
  const valid: Checkpoint[] = []
  let present = 0
  const keys = new Set(await store.keys())
  for (const key of CHECKPOINT_KEYS) {
    if (!keys.has(key)) continue
    present++
    const bytes = await store.get(key)
    try {
      const envelope = JSON.parse(text(bytes))
      if (envelope.schema !== 1 || typeof envelope.payload !== 'string' || envelope.checksum !== await digest(envelope.payload)) throw new Error('Invalid checkpoint checksum')
      const result = JSON.parse(envelope.payload, jsonParseBigInt)
      if (!Number.isSafeInteger(result.generation) || result.generation < 0 || result.generation % 2 !== CHECKPOINT_KEYS.indexOf(key)) throw new Error('Invalid checkpoint generation')
      validateCheckpoint(result.snapshot, chainId, requiredContracts)
      valid.push(result)
    } catch { /* The other independently validated slot may still be complete. */ }
  }
  if (present && !valid.length) throw new Error('No valid state checkpoint remains; preserve this data root and rebuild in a separate root')
  return valid.sort((left, right) => right.generation - left.generation)[0]
}

/** Read and hash-check complete ancestry before changing any derived account state. */
export async function recoveryHistory(hash: string, readBlock: (hash: string) => Promise<Uint8Array | undefined>, anchor: ChainTip = { index: -1, hash: '0x0' }) {
  const reversed = []
  const seen = new Set<string>()
  while (hash !== '0x0' && hash !== anchor.hash) {
    if (!hash || seen.has(hash)) throw new Error('Invalid or cyclic recovery ancestry')
    seen.add(hash)
    const bytes = await readBlock(hash)
    if (!bytes) throw new Error(`Recovery block unavailable: ${hash}`)
    const message = new BlockMessage(bytes)
    if (await message.hash() !== hash) throw new Error(`Recovery block hash mismatch: ${hash}`)
    reversed.push({ ...message.decoded, hash, loaded: false })
    hash = message.decoded.previousHash
  }
  if (anchor.hash !== '0x0' && hash !== anchor.hash)
    throw new Error(`Recovery ancestry does not extend canonical tip ${anchor.hash} at index ${anchor.index}`)
  const history = reversed.reverse()
  let tip: ChainTip = anchor
  for (const block of history) {
    const index = Number(block.index)
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid recovery block index')
    if (validateChainLink(tip, { index, hash: block.hash, previousHash: block.previousHash }) !== 'append') throw new Error('Invalid recovery chain link')
    tip = { index, hash: block.hash }
  }
  return history
}

export async function restoreAccountNonces(store: Storage, accounts: Record<string, string>) {
  // This is derived nonce state, never wallet/identity data. It is always replaced
  // from the verified checkpoint so a crash during this step is safely repeatable.
  await store.clear()
  for (const [address, nonce] of Object.entries(accounts)) await store.put(address, String(nonce))
}
