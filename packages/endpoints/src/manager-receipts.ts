type Store = {
  has(key: string): Promise<boolean>
  get(key: string): Promise<Uint8Array | string>
  put(key: string, value: Uint8Array): Promise<unknown>
}
type Block = { index: number | bigint | string; hash: string; transactions: string[] }
type Chain = {
  lastBlock: Block | Promise<Block>
  machine?: { getCanonicalTip(): Promise<Block> }
  getBlocks(from: number, to: number): Promise<Block[]>
}
export type Receipt = {
  hash: string; status: string; createdAt: number; error?: string
  startHeight: number; scannedHeight?: number; scannedHash?: string; blockHeight?: number; blockHash?: string
}
const statuses = ['submitting', 'pending', 'confirmed', 'failed', 'unknown']
const LIMIT = 512

/** Uses the node's already isolated durable chain store, never a shared filesystem path. */
export class ManagerReceipts {
  #tail: Promise<unknown> = Promise.resolve()
  constructor(private store: () => Store, private chain: Chain) {}
  async tip() {
    return this.chain.machine ? this.chain.machine.getCanonicalTip() : await this.chain.lastBlock
  }
  async #block(index: number): Promise<Block> {
    const blocks = await this.chain.getBlocks(index, index + 1)
    const block = blocks[0]
    if (!block || Number(block.index) !== index || !Array.isArray(block.transactions) || typeof block.hash !== 'string')
      throw new Error(`Canonical block ${index} is unavailable; retry reconciliation later`)
    return block
  }

  serialized<T>(work: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(work)
    this.#tail = next.catch(error => { console.error('Management receipt operation failed:', error) })
    return next
  }
  async load(chainId: string): Promise<Map<string, Receipt>> {
    const store = this.store()
    if (!store) throw new Error('Durable chain store is unavailable; management writes are disabled')
    const key = `manager:receipts:v1:${chainId}`
    if (!await store.has(key)) return new Map()
    const raw = await store.get(key)
    const parsed = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
    if (!Array.isArray(parsed) || parsed.length > LIMIT || parsed.some(value =>
      !value || typeof value.hash !== 'string' || !/^[A-Z2-7]{32,128}$/.test(value.hash) ||
      !statuses.includes(value.status) || !Number.isSafeInteger(value.createdAt) ||
      !Number.isSafeInteger(value.startHeight) || value.startHeight < 0 ||
      (value.scannedHeight !== undefined && (!Number.isSafeInteger(value.scannedHeight) || value.scannedHeight < 0)) ||
      (value.blockHeight !== undefined && (!Number.isSafeInteger(value.blockHeight) || value.blockHeight < 1)) ||
      (value.blockHash !== undefined && typeof value.blockHash !== 'string') ||
      (value.scannedHash !== undefined && typeof value.scannedHash !== 'string') ||
      (value.error !== undefined && typeof value.error !== 'string')))
      throw new Error('Stored management receipts are invalid; refusing to overwrite them')
    return new Map(parsed.map(receipt => [receipt.hash, receipt]))
  }
  async save(chainId: string, receipts: Map<string, Receipt>) {
    await this.store().put(`manager:receipts:v1:${chainId}`, new TextEncoder().encode(JSON.stringify([...receipts.values()])))
  }
  reserve(receipts: Map<string, Receipt>, receipt: Receipt) {
    if (receipts.size >= LIMIT) {
      const completed = [...receipts].find(([, value]) => ['confirmed', 'failed'].includes(value.status))
      if (!completed) throw new Error('Receipt capacity reached; reconcile pending transactions first')
      receipts.delete(completed[0])
    }
    receipts.set(receipt.hash, receipt)
  }
  async complete(chainId: string, hash: string, status: 'confirmed' | 'failed', error?: string) {
    return this.serialized(async () => {
      const receipts = await this.load(chainId)
      const receipt = receipts.get(hash)
      if (!receipt) throw new Error('Receipt disappeared before canonical completion')
      receipt.status = status
      receipt.error = error
      await this.save(chainId, receipts)
    })
  }
  async reconcile(receipt: Receipt): Promise<Receipt> {
    if (typeof this.chain.getBlocks !== 'function') throw new Error('Node does not support canonical receipt reconciliation')
    const tip = await this.tip()
    const height = Number(tip?.index ?? 0)
    if (!Number.isSafeInteger(height) || height < 0) throw new Error('Invalid canonical height')
    const assertStable = async () => {
      const current = await this.tip()
      if (String(current?.index ?? 0) !== String(tip?.index ?? 0) || current?.hash !== tip?.hash)
        throw new Error('Canonical tip changed during reconciliation; refresh again')
    }
    // Recheck recorded inclusion instead of trusting a previous process's observation.
    if (receipt.blockHeight !== undefined) {
      const block = receipt.blockHeight <= height ? await this.#block(receipt.blockHeight) : undefined
      if (block?.transactions?.includes(receipt.hash)) {
        await assertStable()
        return { ...receipt, status: 'confirmed', error: undefined, blockHash: block.hash }
      }
      receipt = { ...receipt, status: 'unknown', blockHeight: undefined, blockHash: undefined, scannedHeight: undefined, scannedHash: undefined, startHeight: 0 }
    }
    if (receipt.scannedHeight && receipt.scannedHash) {
      const anchor = receipt.scannedHeight <= height ? await this.#block(receipt.scannedHeight) : undefined
      if (anchor?.hash !== receipt.scannedHash)
        receipt = { ...receipt, scannedHeight: undefined, scannedHash: undefined, startHeight: 0 }
    }
    // Scan a bounded range per refresh; no pool membership or nonce heuristic proves confirmation.
    const start = Math.max(1, Math.min(receipt.scannedHeight ?? (receipt.startHeight - 1), height) + 1)
    const end = Math.min(height, start + 127)
    let scannedHash = receipt.scannedHash
    for (let index = start; index <= end; index++) {
      const block = await this.#block(index)
      if (block.transactions.includes(receipt.hash)) {
        await assertStable()
        return { ...receipt, status: 'confirmed', error: undefined, blockHeight: index, blockHash: block.hash, scannedHeight: index, scannedHash: block.hash }
      }
      scannedHash = block.hash
    }
    await assertStable()
    // Even fully scanned absence is not failure: delivery or execution may still be pending.
    return {
      ...receipt, scannedHeight: Math.max(receipt.scannedHeight ?? 0, end),
      scannedHash,
      status: receipt.status === 'failed' ? 'failed' : 'unknown',
      error: receipt.status === 'failed' ? receipt.error : 'No canonical inclusion observed yet. Refresh to continue reconciliation; do not resend.'
    }
  }
}
