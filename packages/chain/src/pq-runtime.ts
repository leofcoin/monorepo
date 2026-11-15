import { isPqIdentityProvider, PQ_NETWORK } from '@leofcoin/lib/pq'
import { assertPqGenesis, type PqGenesis } from '@leofcoin/lib/pq-genesis'

// One node per realm. Never release a reservation after failure: stores may have opened.
let reservation: { chainId: string; chainStarted: boolean } | undefined

export function reserveNode(config: { network?: string; genesis?: PqGenesis; identity?: unknown }) {
  if (reservation) throw new Error('PQ realm already reserved; use a new process/isolated browser realm')
  const identity = config.identity
  const selectedAccount = identity && typeof identity === 'object'
    ? (identity as { selectedAccount?: unknown }).selectedAccount
    : undefined
  if (config.network !== PQ_NETWORK) {
    if (config.genesis || isPqIdentityProvider(config.identity) ||
      (typeof selectedAccount === 'string' && selectedAccount.startsWith('lfc-pq')))
      throw new Error('PQ genesis/identity forbidden on classical networks')
    return
  }
  assertPqGenesis(config.genesis)
  if (!isPqIdentityProvider(config.identity)) throw new Error('PQ network requires an explicit PQ identity provider')
  config.identity.bindChainId(config.genesis.chainId)
  for (const name of ['peernet', 'chain', 'accountStore', 'walletStore', 'blockStore', 'transactionStore',
    'chainStore', 'stateStore', 'accountsStore', 'contractStore', 'transactionPoolStore']) {
    const realm = globalThis as typeof globalThis & Record<string, unknown>
    if (realm[name]) throw new Error(`PQ realm is not empty (${name}); use a new process/isolated browser realm`)
  }
  reservation = { chainId: config.genesis.chainId, chainStarted: false }
}

export function reserveChain(network?: string, genesis?: PqGenesis) {
  if (network !== PQ_NETWORK) {
    if (reservation) throw new Error('Classical chain forbidden in a PQ realm')
    return
  }
  assertPqGenesis(genesis)
  const realm = globalThis as typeof globalThis & Record<string, unknown>
  const peer = realm.peernet
  const peerGenesis = peer && typeof peer === 'object'
    ? (peer as { pqGenesis?: unknown }).pqGenesis
    : undefined
  const peerChainId = peerGenesis && typeof peerGenesis === 'object'
    ? (peerGenesis as { chainId?: unknown }).chainId
    : undefined
  if (!reservation || reservation.chainId !== genesis.chainId || reservation.chainStarted ||
    !peer || typeof peer !== 'object' ||
    (peer as { ledgerNetwork?: unknown }).ledgerNetwork !== PQ_NETWORK ||
    peerChainId !== genesis.chainId)
    throw new Error('PQ chain requires its initialized, matching, unused PQ node realm')
  reservation.chainStarted = true
}
