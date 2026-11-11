import { verifyChainIdentity } from '@leofcoin/lib/chain-identity'
import { encodeWire, decodeWire, BINARY_CONTENT_TYPE } from '@leofcoin/binary'
import { getExplorerSourcePreference, getSelectedNetwork } from '../network-selection.js'

const MAX_RESPONSE = 4 * 1024 * 1024
const LOCAL_PROBE_TIMEOUT_MS = 2500
const LOCAL_EXPLORER_ENDPOINT = 'http://localhost:8080'
const sources = new Map()

class LocalExplorerUnavailable extends Error {}

async function createReadOnlyExplorerSource(network, endpoint, fetcher, kind) {
  const expectedChainId = network.chainId
  const origin = new URL(endpoint)
  if ((origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))) ||
    origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('Invalid public explorer endpoint')
  let chainId = expectedChainId
  async function read(resource, query = {}, initial = false) {
    const url = new URL(`explorer/${resource}`, origin)
    const body = encodeWire('rpc', { ...query, ...(!initial ? { chainId } : {}) })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), kind === 'local' ? LOCAL_PROBE_TIMEOUT_MS : 8000)
    try {
      let response
      try {
        response = await fetcher(url.href, { method: 'POST', body, headers: { 'Content-Type': BINARY_CONTENT_TYPE }, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal })
      } catch (error) {
        if (kind === 'local' && (controller.signal.aborted || error instanceof TypeError))
          throw new LocalExplorerUnavailable('Local HTTP explorer is unavailable')
        throw error
      }
      if (!response.ok) {
        if (kind === 'local' && [404, 405].includes(response.status))
          throw new LocalExplorerUnavailable('Local HTTP explorer API is unavailable')
        throw new Error(response.status === 404
          ? 'The public node does not yet provide this read-only explorer API. Update the remote node, then retry.'
          : `Explorer unavailable (HTTP ${response.status}). Retry after node sync.`)
      }
      if (response.headers.get('content-type')?.split(';')[0] !== BINARY_CONTENT_TYPE) {
        if (kind === 'local') throw new LocalExplorerUnavailable('Local node does not provide the read-only explorer API')
        throw new Error('Public node must support binary RPC')
      }
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
      if (result.apiVersion !== 1 || (chainId && result.chainId !== chainId))
        throw new Error('Explorer chain identity changed or is unsupported. Data was not accepted.')
      return result
    } catch (error) {
      if (controller.signal.aborted) {
        if (kind === 'local') throw new LocalExplorerUnavailable('Local HTTP explorer is unavailable')
        throw new Error('Explorer read timed out. Retry to reconnect.')
      }
      throw error
    } finally { clearTimeout(timeout) }
  }
  let status = await read('status', {}, true)
  const identity = await verifyChainIdentity(status.identity)
  if (identity.network !== network.network || (expectedChainId && identity.chainId !== expectedChainId) ||
    status.chainId !== identity.chainId || status.nativeToken !== identity.genesisContracts.nativeToken)
    throw new Error('Explorer belongs to a different chain or network')
  if (kind === 'local' && (typeof status.synced !== 'boolean' ||
    !status.tip || !['bigint', 'number'].includes(typeof status.tip.index) ||
    !Array.isArray(status.peers) || status.peers.length > 100))
    throw new Error('Local node returned invalid explorer status')
  const nodeInfo = kind === 'local' ? Object.freeze({
    endpoint: origin.origin,
    network: identity.network,
    chainId: identity.chainId,
    synced: status.synced,
    tipIndex: status.tip.index,
    connectedPeers: status.peers.length
  }) : undefined
  chainId = identity.chainId
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
    if (result === null || result === undefined) throw new Error(`Explorer ${key} data unavailable`)
    return result
  }
  let poolRequest
  const pool = () => poolRequest ||= read('pool').then(result => {
    if (!Array.isArray(result.hashes) || result.hashes.length > 101 || result.hashes.some(hash => !/^[A-Z2-7]{32,128}$/.test(hash))) throw new Error('Invalid explorer pool response')
    return result.hashes
  }).catch(error => { poolRequest = undefined; throw error })
  const getContent = async (hash, kind) => {
    if (!/^[A-Z2-7]{32,128}$/.test(hash) || !['block', 'transaction'].includes(kind)) throw new Error('Invalid explorer content request')
    const result = await read(kind, { hash })
    if (!(result.encoded instanceof Uint8Array) || result.encoded.length > 1_048_576) throw new Error('Invalid explorer content size')
    return result.encoded
  }
  const chain = Object.freeze({
    nativeToken: identity.genesisContracts.nativeToken,
    get lastBlock() { return currentStatus().then(result => result.tip) },
    getBlocks: async (from, to) => {
      if (!Number.isSafeInteger(from) || from < 0 || !Number.isSafeInteger(to) || to <= from || to - from > 25) throw new Error('Invalid explorer block range')
      const result = await read('blocks', { from, count: to - from })
      if (!Array.isArray(result.blocks) || result.blocks.length > 25) throw new Error('Invalid explorer block page')
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
  return Object.freeze({ kind, label: kind === 'local' ? 'Local node · read-only' : `${origin.host} · read-only`, origin: origin.origin, nodeInfo, chain, client,
    identity,
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

export async function createPublicExplorerSource(network, fetcher = globalThis.fetch) {
  if (!network.explorerEndpoint || !network.chainId) throw new Error('No public read-only explorer is configured for this network. No wallet login is required; a matching public endpoint must be published first.')
  return createReadOnlyExplorerSource(network, network.explorerEndpoint, fetcher, 'public')
}

async function createLocalExplorerSource(network, fetcher = globalThis.fetch) {
  try {
    return await createReadOnlyExplorerSource(network, LOCAL_EXPLORER_ENDPOINT, fetcher, 'local')
  } catch (error) {
    if (error instanceof LocalExplorerUnavailable) return undefined
    throw error
  }
}

export async function discoverLocalNode(network = getSelectedNetwork(), fetcher = globalThis.fetch) {
  const source = await createLocalExplorerSource(network, fetcher)
  return source?.nodeInfo
}

/** System contracts are protocol identities, not mutable name-registry entries. */
export async function explorerSystemContracts(source, network = getSelectedNetwork()) {
  const identity = await verifyChainIdentity(source.identity || await source.chain.getChainIdentity())
  if (identity.network !== network.network || (network.chainId && identity.chainId !== network.chainId))
    throw new Error('Explorer source belongs to a different chain or network')
  return identity.genesisContracts
}

export async function getExplorerSource() {
  const network = getSelectedNetwork()
  const preference = getExplorerSourcePreference()
  const browserSource = () => globalThis.chain ? { kind: 'local', label: 'Your browser node', chain: globalThis.chain, client: globalThis.client,
    peernet: globalThis.peernet, transactionStore: globalThis.transactionStore, transactionPoolStore: globalThis.transactionPoolStore } : undefined
  const browser = browserSource()
  if (preference === 'browser' && browser) return browser
  const key = `${network.key}:${network.explorerEndpoint}:${network.chainId}:${preference}`
  if (!sources.has(key)) sources.set(key, (async () => {
    if (preference === 'local-first') {
      const local = await createLocalExplorerSource(network)
      if (local) return local
    }
    return browserSource() || createPublicExplorerSource(network)
  })().catch(error => { sources.delete(key); throw error }))
  const source = await sources.get(key)
  if (source.label === 'Your browser node') sources.delete(key)
  return preference === 'local-first' && source.kind === 'public' ? browserSource() || source : source
}
