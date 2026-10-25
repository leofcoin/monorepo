export const CHAIN_ID_SCHEMA = 'leofcoin:chain-identity:v1'
export const GENESIS_CONTRACT_NAMES = ['contractFactory', 'nativeToken', 'nameService', 'validators'] as const
export type GenesisContracts = Record<typeof GENESIS_CONTRACT_NAMES[number], string>
export type ChainIdentity = { schema: string; chainId: string; network: string; genesisContracts: GenesisContracts }

export const assertChainId = (value: unknown): string => {
  if (typeof value !== 'string' || !/^lfc:[0-9a-f]{64}$/.test(value)) throw new Error('Invalid chain ID; expected lfc: followed by 64 lowercase hex characters')
  return value
}

/** Bind identity to immutable genesis artifacts, not the current tip, label or endpoints. */
export const createChainIdentity = async (network: string, contracts: GenesisContracts): Promise<ChainIdentity> => {
  if (typeof network !== 'string' || !/^[a-z0-9][a-z0-9:-]{0,79}$/.test(network)) throw new Error('Invalid genesis network namespace')
  const genesisContracts = {} as GenesisContracts
  for (const name of GENESIS_CONTRACT_NAMES) {
    const hash = contracts?.[name]
    if (typeof hash !== 'string' || !/^[A-Z2-7]{32,128}$/.test(hash)) throw new Error(`Invalid genesis contract hash: ${name}`)
    genesisContracts[name] = hash
  }
  const bytes = new TextEncoder().encode(JSON.stringify({ schema: CHAIN_ID_SCHEMA, network, genesisContracts }))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  const chainId = 'lfc:' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return { schema: CHAIN_ID_SCHEMA, chainId, network, genesisContracts }
}

export const verifyChainIdentity = async (value: unknown): Promise<ChainIdentity> => {
  const identity = value as ChainIdentity
  if (!identity || identity.schema !== CHAIN_ID_SCHEMA) throw new Error('Unsupported chain identity response')
  const verified = await createChainIdentity(identity.network, identity.genesisContracts)
  if (verified.chainId !== assertChainId(identity.chainId)) throw new Error('Chain ID does not match its genesis contracts')
  return verified
}

/** Bounded, read-only observation. No response is never proof of nonexistence. */
export const findChainPresence = async (
  chainId: string,
  peerIds: string[],
  requestIdentity: (peerId: string) => Promise<unknown>,
  timeoutMs = 3000
) => {
  assertChainId(chainId)
  const peers = [...new Set(peerIds)].slice(0, 16)
  const matches: string[] = []
  let responded = 0
  let unavailable = 0
  await Promise.all(peers.map(async peerId => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => requestIdentity(peerId)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Chain identity request timed out')), timeoutMs) })
      ])
      const identity = await verifyChainIdentity(result)
      responded++
      if (identity.chainId === chainId) matches.push(peerId)
    } catch { unavailable++ }
    finally { clearTimeout(timer) }
  }))
  return {
    chainId,
    status: matches.length ? 'found' : !peers.length || unavailable ? 'unknown' : 'not-observed',
    checkedPeers: peers.length, respondedPeers: responded, unavailablePeers: unavailable,
    matchingPeers: matches.sort(),
    scope: 'reachable peers only; offline or undiscovered chains may still exist'
  }
}
