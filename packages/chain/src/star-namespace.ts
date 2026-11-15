import addresses from '@leofcoin/addresses'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { DEFAULT_NODE_OPTIONS, CHAIN_APP_ID, PROTOCOL_VERSION, type NodeOptions } from './constants.js'
import { nodeDataRoot } from './routing-identity.js'
import { PQ_NETWORK } from '@leofcoin/lib/pq'
import { validatePqGenesis } from '@leofcoin/lib/pq-genesis'
export { chainNetwork } from './ledger-network.js'

type DiscoveryOptions = NodeOptions & { network: string }

/** Pin discovery to bundled genesis before starting the transport; never derive it from an untrusted peer. */
export async function chainDiscoveryOptions(options: NodeOptions = {}): Promise<DiscoveryOptions> {
  // Old launchers may still pass these internally. Do not expose or forward
  // them as competing SDK options, and never accept contradictory labels.
  const {networkVersion,version,...input} = options as NodeOptions & {networkVersion?:string;version?:string}
  const config = {...DEFAULT_NODE_OPTIONS,...input}
  if (typeof config.network !== 'string' || !config.network) throw new Error('Chain discovery requires a network')
  if (config.network === PQ_NETWORK) {
    if (!config.genesis) throw new Error('PQ discovery requires a genesis bundle')
    config.genesis = await validatePqGenesis(config.genesis)
    config.stars = [...(options.stars ?? [])]
    Object.freeze(config.stars)
    // Private local discovery only; do not silently inherit public Peach stars.
    for (const endpoint of config.stars) {
      const url = new URL(endpoint)
      if (!['ws:', 'wss:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.username || url.password) throw new Error('PQ bootstrap endpoints must be explicitly local')
    }
  } else if (config.genesis) throw new Error('PQ genesis forbidden on classical networks')
  if (networkVersion !== undefined && networkVersion !== (config.network.split(':')[1] ?? 'mainnet'))
    throw new Error('Use the full network name; legacy networkVersion conflicts with network')
  if (version !== undefined && version !== config.protocolVersion) throw new Error('Chain discovery version mismatch')
  const identity = await createChainIdentity(config.network, config.genesis?.addresses ?? addresses)
  if (config.chainId !== undefined && config.chainId !== identity.chainId) throw new Error('Discovery chainId does not match bundled genesis')
  if (Object.hasOwn(options,'protocol') || Object.hasOwn(options,'discoveryNetwork')) throw new Error('Use network and protocolVersion for discovery')
  if (config.protocolVersion !== PROTOCOL_VERSION) throw new Error('Chain discovery version mismatch')
  return {...config,chainId:identity.chainId}
}

/** Adapt chain wallet/ledger configuration; never pass its legacy aliases to Peernet. */
export function chainPeernetOptions(config: DiscoveryOptions) {
  const {network,protocolVersion,chainId,...options} = config
  delete options.genesis
  delete options.identity
  const name = network.split(':')[1] ?? 'mainnet'
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) throw new Error('Invalid chain network name')
  return {...options,root:nodeDataRoot(config),network:`${CHAIN_APP_ID}:${name}`,protocolVersion,chainId}
}

export function assertDiscoveryNamespace(peer: {namespace?:unknown}, config: DiscoveryOptions) {
  const scope = peer.namespace as {protocolVersion?:string;network?:string;chainId?:string}
  if (!scope || scope.protocolVersion !== config.protocolVersion ||
    scope.network !== chainPeernetOptions(config).network || scope.chainId !== config.chainId)
    throw new Error('Chain requires the network-isolated Peernet release before starting discovery')
}
