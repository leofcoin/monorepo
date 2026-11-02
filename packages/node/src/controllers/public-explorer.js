import { verifyChainIdentity } from '@leofcoin/lib/chain-identity'
import { encodeWire, decodeWire, BINARY_CONTENT_TYPE } from '@leofcoin/binary'
import { getSelectedNetwork } from '../network-selection.js'

const MAX_RESPONSE = 4 * 1024 * 1024
const sources = new Map()

export async function createPublicExplorerSource(network, fetcher = globalThis.fetch) {
  if (!network.explorerEndpoint || !network.chainId) throw new Error('No public read-only explorer is configured for this network. No wallet login is required; a matching public endpoint must be published first.')
  const origin = new URL(network.explorerEndpoint)
  if ((origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))) ||
    origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('Invalid public explorer endpoint')
  async function read(resource, query = {}, initial = false) {
    const url = new URL(`explorer/${resource}`, origin)
    const body = encodeWire('rpc', { ...query, ...(!initial ? { chainId: network.chainId } : {}) })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetcher(url.href, { method: 'POST', body, headers: { 'Content-Type': BINARY_CONTENT_TYPE }, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal })
      if (!response.ok) throw new Error(response.status === 404
        ? 'The public node does not yet provide this read-only explorer API. Update the remote node, then retry.'
        : `Public explorer unavailable (HTTP ${response.status}). Retry after node sync.`)
      if (response.headers.get('content-type')?.split(';')[0] !== BINARY_CONTENT_TYPE) throw new Error('Public node must support binary RPC')
      const reader = response.body.getReader()
      let bytes = 0
      const chunks = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > MAX_RESPONSE) { await reader.cancel(); throw new Error('Public explorer response exceeds 4 MiB') }
        chunks.push(value)
      }
      const combined = new Uint8Array(bytes)
      let offset = 0
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length }
      const result = decodeWire('rpc', combined, { maxBytes: MAX_RESPONSE })
      if (result.apiVersion !== 1 || result.chainId !== network.chainId) throw new Error('Public explorer chain identity changed or is unsupported. Data was not accepted.')
      return result
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Public explorer read timed out. Retry to reconnect.')
      throw error
    } finally { clearTimeout(timeout) }
  }
  let status = await read('status', {}, true)
  const identity = await verifyChainIdentity(status.identity)
  if (identity.network !== network.network || identity.chainId !== network.chainId || status.nativeToken !== identity.genesisContracts.nativeToken)
    throw new Error('Public explorer belongs to a different chain or network')
  let statusAt = Date.now()
  let statusRequest
  const currentStatus = () => {
    if (Date.now() - statusAt < 3000) return Promise.resolve(status)
    return statusRequest ||= read('status', {}, true).then(async next => {
      const nextIdentity = await verifyChainIdentity(next.identity)
      if (nextIdentity.chainId !== identity.chainId || nextIdentity.network !== identity.network) throw new Error('Public explorer chain identity changed')
      status = next; statusAt = Date.now(); return next
    }).finally(() => { statusRequest = undefined })
  }
  let overviewRequest
  let overviewAt = 0
  const overview = () => {
    if (!overviewRequest || Date.now() - overviewAt > 3000) {
      overviewAt = Date.now()
      overviewRequest = read('overview').catch(error => { overviewRequest = undefined; throw error })
    }
    return overviewRequest
  }
  const value = async key => {
    const result = (await overview())[key]
    if (result === null || result === undefined) throw new Error(`Public ${key} data unavailable`)
    return result
  }
  let poolRequest
  const pool = () => poolRequest ||= read('pool').then(result => {
    if (!Array.isArray(result.hashes) || result.hashes.length > 101 || result.hashes.some(hash => !/^[A-Z2-7]{32,128}$/.test(hash))) throw new Error('Invalid public pool response')
    return result.hashes
  }).catch(error => { poolRequest = undefined; throw error })
  const getContent = async (hash, kind) => {
    if (!/^[A-Z2-7]{32,128}$/.test(hash) || !['block', 'transaction'].includes(kind)) throw new Error('Invalid public content request')
    const result = await read(kind, { hash })
    if (!(result.encoded instanceof Uint8Array) || result.encoded.length > 1_048_576) throw new Error('Invalid public content size')
    return result.encoded
  }
  const chain = Object.freeze({
    nativeToken: identity.genesisContracts.nativeToken,
    get lastBlock() { return currentStatus().then(result => result.tip) },
    getBlocks: async (from, to) => {
      if (!Number.isSafeInteger(from) || from < 0 || !Number.isSafeInteger(to) || to <= from || to - from > 25) throw new Error('Invalid public block range')
      const result = await read('blocks', { from, count: to - from })
      if (!Array.isArray(result.blocks) || result.blocks.length > 25) throw new Error('Invalid public block page')
      return result.blocks
    }
  })
  const client = Object.freeze({
    lookup: async name => ({ address: name === 'LeofcoinValidators' ? identity.genesisContracts.validators : name === 'LeofcoinContractFactory' ? identity.genesisContracts.contractFactory : (() => { throw new Error('Unsupported public lookup') })() }),
    staticCall: async (contract, method) => {
      if (contract === identity.genesisContracts.validators && method === 'validators') return value('validators')
      if (contract === identity.genesisContracts.contractFactory && method === 'totalContracts') return value('registeredContracts')
      throw new Error('Unsupported public read; contract execution is not exposed')
    },
    nativeTransfers: () => value('nativeTransfers'), nativeBurns: () => value('nativeBurns'), nativeMints: () => value('nativeMints'),
    nativeCalls: () => value('nativeCalls'), totalContracts: () => value('totalContracts'), totalTransactions: () => value('totalTransactions'),
    totalSize: () => value('totalSize'), transactionsInPool: () => value('poolCount'), transactionPoolSize: () => value('poolSize'),
    lastBlockHeight: async () => (await currentStatus()).tip.index,
    peers: async () => (await currentStatus()).peers,
    blocks: async amount => {
      const tip = Number((await currentStatus()).tip.index)
      const count = Math.min(128, Math.max(0, Math.abs(amount)))
      const blocks = []
      for (let from = Math.max(0, tip - count + 1); from <= tip; from += 25) blocks.push(...await chain.getBlocks(from, Math.min(tip + 1, from + 25)))
      return blocks
    }
  })
  return Object.freeze({ kind: 'public', label: `${origin.host} · read-only`, origin: origin.origin, chain, client,
    transactionReader: hash => getContent(hash, 'transaction'),
    peernet: Object.freeze({ get: getContent }),
    transactionPoolStore: Object.freeze({ keys: () => { poolRequest = undefined; return pool() }, has: async hash => (await pool()).includes(hash), get: hash => getContent(hash, 'transaction') }),
    getHolderRankings: async () => {
      const holders = await value('holders')
      if (!Number.isSafeInteger(holders.total) || holders.total < 0 || !Array.isArray(holders.holders) || holders.holders.length > 5 ||
        holders.holders.some(holder => typeof holder.address !== 'string' || !/^\d+$/.test(String(holder.balance)) ||
          !Number.isFinite(holder.share) || holder.share < 0 || holder.share > 100)) throw new Error('Invalid public holder ranking')
      return holders
    } })
}

export async function getExplorerSource() {
  if (globalThis.chain) return { kind: 'local', label: 'Your local node', chain: globalThis.chain, client: globalThis.client,
    peernet: globalThis.peernet, transactionStore: globalThis.transactionStore, transactionPoolStore: globalThis.transactionPoolStore }
  const network = getSelectedNetwork()
  const key = `${network.key}:${network.explorerEndpoint}:${network.chainId}`
  if (!sources.has(key)) sources.set(key, createPublicExplorerSource(network).catch(error => { sources.delete(key); throw error }))
  return sources.get(key)
}
