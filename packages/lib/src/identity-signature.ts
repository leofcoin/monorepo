import MultiWallet from '@leofcoin/multi-wallet'
import { fromBase58 } from '@vandeurenglenn/typed-array-utils'
import { PQ_NETWORK, verifyPqDigest } from './pq.js'

/** Network policy is selected by the caller, never by an untrusted address/header. */
export async function verifyIdentityDigest(
  address: string, signature: string, digest: Uint8Array, network: string, chainId?: string
): Promise<boolean> {
  if (typeof signature !== 'string' || !signature) return false
  if (network === PQ_NETWORK) {
    try {
      // Base58(4627 bytes) is at most 6319 characters. Bound work before decoding.
      if (!chainId || signature.length > 6320) return false
      return verifyPqDigest(address, fromBase58(signature), digest, chainId)
    } catch { return false }
  }
  if (typeof address !== 'string' || address.startsWith('lfc-pq')) return false
  const verifier = new MultiWallet(network)
  await verifier.fromAddress(address, undefined, network)
  return await verifier.verify(fromBase58(signature), digest)
}
