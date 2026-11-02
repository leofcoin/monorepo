import { CodecHash } from '@leofcoin/codec-format-interface'
import { boundedRead, explorerLink, safeHeight } from './explorer-data.js'

const invalidQuery = () => new Error('Enter a block index, complete block hash or transaction hash.')

export function parseExplorerSearch(input) {
  if (typeof input === 'number' && (!Number.isSafeInteger(input) || input < 0)) throw invalidQuery()
  const value = String(input ?? '').trim()
  if (!value || value.length > 160) throw invalidQuery()
  if (/^\d+n?$/.test(value)) return { kind: 'index', index: BigInt(value.replace(/n$/, '')) }
  const hash = value.toUpperCase()
  if (!/^[A-Z2-7]+$/.test(hash)) throw invalidQuery()
  try {
    const codec = new CodecHash()
    codec.fromBs32(hash)
    const kind = { 'block-message': 'block', 'transaction-message': 'transaction' }[codec.name]
    // Decode the real header; a textual prefix alone does not prove a full hash.
    if (!kind || codec.size !== 32 || codec.toBs32() !== hash) throw invalidQuery()
    return { kind, hash }
  } catch { throw invalidQuery() }
}

export async function resolveExplorerSearch(input, getSource) {
  const query = parseExplorerSearch(input)
  if (query.kind !== 'index') return explorerLink(query.kind, { selected: query.hash })
  // getBlocks currently uses safe-number, end-exclusive array ranges. Never round
  // a BigInt into a different block, including at the end + 1 boundary.
  if (query.index >= BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(`Block #${query.index} is outside the index range supported by this node API.`)
  const index = Number(query.index)
  const source = await getSource()
  const blocks = await boundedRead(() => source.chain.getBlocks(index, index + 1))
  const block = Array.isArray(blocks) && blocks.find(block => block && block.loaded !== false && safeHeight(block.index) === index)
  if (!block?.hash) throw new Error(`Block #${query.index} is not available from this source.`)
  const target = parseExplorerSearch(block.hash)
  if (target.kind !== 'block') throw new Error('The source returned an invalid block hash.')
  return explorerLink('block', { selected: target.hash, index: query.index.toString() })
}
