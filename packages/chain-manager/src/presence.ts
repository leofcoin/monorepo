import { assertChainId, verifyChainIdentity } from '@leofcoin/lib/chain-identity'

export type ChainPresence = { status: 'found' | 'not-observed' | 'unknown' }

export async function checkChainPresence(endpoint: string, chainId: string): Promise<ChainPresence> {
  assertChainId(chainId)
  if (!endpoint.trim()) return { status: 'unknown' }
  const url = new URL(endpoint)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Enter an HTTP(S) node endpoint without credentials, a query or a fragment')
  }
  url.pathname = `${url.pathname.replace(/\/$/, '')}/chainIdentity`
  const response = await fetch(url, {
    signal: AbortSignal.timeout(3000),
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store'
  })
  if (!response.ok) throw new Error(`Node identity request failed: HTTP ${response.status}`)
  const identity = await verifyChainIdentity(await response.json())
  return { status: identity.chainId === chainId ? 'found' : 'not-observed' }
}
