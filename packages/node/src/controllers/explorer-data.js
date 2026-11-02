import { BlockMessage, TransactionMessage } from '@leofcoin/messages'

export const PAGE_SIZE = 25
export const shortId = value => typeof value === 'string' && value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : String(value ?? '—')
export const explorerLink = (view, params = {}) => `#!/explorer/${view}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''}`
export const stringify = value => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2)

export function formatLfc(units) {
  if (!/^(0|[1-9]\d*)$/.test(String(units)) || (typeof units === 'number' && !Number.isSafeInteger(units))) return '—'
  const value = BigInt(units)
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '')
  return `${(value / 10n ** 18n).toLocaleString('en-US')}${fraction ? `.${fraction}` : ''}`
}

export function compactLfc(units) {
  const full = formatLfc(units)
  if (full === '—' || !full.includes('.')) return full
  const [whole, fraction] = full.split('.')
  if (whole === '0' && !/[1-9]/.test(fraction.slice(0, 6))) return '<0.000001'
  return fraction.length > 6 ? `${whole}.${fraction.slice(0, 6)}…` : full
}

export function nativeMovement(tx, nativeToken) {
  if (!nativeToken || tx?.to !== nativeToken || !Array.isArray(tx.params)) return null
  const position = tx.method === 'transferFrom' ? 2 : ['transfer', 'mint', 'burn'].includes(tx.method) ? 1 : -1
  if (position < 0 || formatLfc(tx.params[position]) === '—') return null
  return { units: tx.params[position], recipient: tx.method === 'burn' ? null : tx.method === 'transferFrom' ? tx.params[1] : tx.params[0] }
}

export function safeHeight(value) {
  if (typeof value !== 'number' && typeof value !== 'bigint') throw new Error('Block height is unavailable.')
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < -1) throw new Error('Invalid block height.')
  return number
}

export async function boundedRead(operation, timeout = 8000) {
  let timer
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('The local node did not respond. Try again after sync.')), timeout)
    })])
  } finally { clearTimeout(timer) }
}

export async function mapReads(items, read, concurrency = 4) {
  const results = new Array(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await read(items[index], index) }
  }))
  return results
}

export async function readBlockPage(chain, anchor = null) {
  if (!chain?.getBlocks) throw new Error('Start the local node to browse its chain data.')
  const tip = safeHeight((await boundedRead(() => chain.lastBlock))?.index)
  const end = anchor === null ? tip : Math.min(safeHeight(anchor), tip)
  if (end < 0) return { blocks: [], tip, end, start: 0, missing: 0 }
  const start = Math.max(0, end - PAGE_SIZE + 1)
  const input = await boundedRead(() => chain.getBlocks(start, end + 1))
  if (!Array.isArray(input)) throw new Error('The local node returned an invalid block page.')
  const seen = new Set()
  const blocks = []
  for (const block of input) {
    if (!block) continue
    if (block.loaded === false) continue
    const index = safeHeight(block.index)
    if (index < start || index > end || seen.has(index)) continue
    if (!Array.isArray(block.transactions) || !Array.isArray(block.validators) || typeof block.hash !== 'string' || !block.hash)
      throw new Error('A local block is missing its identity or transaction references.')
    seen.add(index)
    blocks.push({ ...block, index })
  }
  blocks.sort((a, b) => b.index - a.index)
  return { blocks, tip, end, start, missing: end - start + 1 - blocks.length }
}

export function transactionReferences(blocks) {
  const references = []
  const seen = new Set()
  for (const block of [...blocks].sort((a, b) => Number(b.index) - Number(a.index))) {
    for (let position = block.transactions.length - 1; position >= 0; position--) {
      const input = block.transactions[position]
      const key = typeof input === 'string' ? input : `${block.hash}:${position}`
      if (seen.has(key)) continue
      seen.add(key)
      references.push({ input, hash: typeof input === 'string' ? input : '', blockIndex: safeHeight(block.index), blockHash: block.hash, position })
    }
  }
  return references
}

export async function readTransaction(reference, stores = {}) {
  const input = reference.input ?? reference.hash
  let raw = input
  if (typeof input === 'string') {
    if (stores.transactionReader) raw = await boundedRead(() => stores.transactionReader(input))
    else {
    const store = stores.transactionStore
    if (store && await boundedRead(() => store.has(input))) raw = await boundedRead(() => store.get(input))
    else if (stores.transactionPoolStore && await boundedRead(() => stores.transactionPoolStore.has(input))) raw = await boundedRead(() => stores.transactionPoolStore.get(input))
    else if (stores.peernet?.get) raw = await boundedRead(() => stores.peernet.get(input, 'transaction'))
    else throw new Error('Transaction data is not available locally.')
    }
  }
  if (!raw) throw new Error('Transaction not found.')
  const message = new TransactionMessage(raw)
  const hash = await message.hash()
  if (reference.hash && reference.hash !== hash) throw new Error('Transaction hash does not match the requested data.')
  return { ...reference, transaction: message.decoded, hash, size: message.encoded.byteLength }
}

export async function readTransactionRows(references, stores) {
  return mapReads(references, async reference => {
    try { return await readTransaction(reference, stores) }
    catch (error) { return { ...reference, error: error instanceof Error ? error.message : String(error) } }
  })
}

export async function readPoolReferences(store) {
  if (!store?.keys) throw new Error('The local transaction pool is not available.')
  const keys = await boundedRead(() => store.keys(101))
  if (!Array.isArray(keys)) throw new Error('The node returned an invalid transaction pool.')
  // Read at most 100 bodies, even if a browser store ignores the key limit.
  return { truncated: keys.length > 100, references: keys.slice(0, 100).map(key => ({ input: String(key), hash: String(key) })) }
}

export async function readBlockContent(hash, peernet) {
  if (!hash) throw new Error('A block hash is required.')
  const raw = await boundedRead(() => peernet?.get(hash, 'block'))
  if (!raw) throw new Error('Block not found.')
  const message = new BlockMessage(raw)
  const actualHash = await message.hash()
  if (actualHash !== hash) throw new Error('Block hash does not match the requested data.')
  if (safeHeight(message.decoded.index) < 0 || !Number.isFinite(Number(message.decoded.timestamp)) ||
    Number.isNaN(new Date(Number(message.decoded.timestamp)).getTime()) ||
    !Array.isArray(message.decoded.transactions) || !Array.isArray(message.decoded.validators)) throw new Error('Malformed block content.')
  return { ...message.decoded, hash: actualHash, size: message.encoded.byteLength }
}
