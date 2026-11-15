import { pathToFileURL } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import addresses from '@leofcoin/addresses'
import { encodeWire, BINARY_CONTENT_TYPE } from '@leofcoin/binary'
import { readBinaryResponse } from '@leofcoin/endpoint-clients/transport'
import { createChainIdentity, verifyChainIdentity } from '@leofcoin/lib/chain-identity'
import { BlockMessage } from '@leofcoin/messages'
import { PROTOCOL_VERSION } from '../packages/chain/src/constants.ts'
import { isBlockProtocolCompatible } from '../packages/chain/src/consensus/protocol-version.ts'

const hashPattern = /^[A-Z2-7]{32,128}$/
const integer = (value, label) => {
  const raw = String(value)
  if (!/^(0|[1-9]\d{0,77})$/.test(raw)) throw new Error(`Invalid ${label}`)
  return BigInt(raw)
}
const decimal = (units, places) => {
  const scale = 10n ** BigInt(places)
  return `${units / scale}.${String(units % scale).padStart(places, '0')}`
}

export async function readTestnetPool({ endpoint, pool, testEuro, fetcher = globalThis.fetch }) {
  const url = new URL(endpoint)
  if ((!['https:', 'http:'].includes(url.protocol)) ||
      (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('Use an HTTPS endpoint or loopback HTTP origin')
  if (!hashPattern.test(pool) || !hashPattern.test(testEuro)) throw new Error('Pool and tEUR must be contract hashes')

  const fetchBinary = async (path, body, maxBytes = 65536) => {
    const response = await fetcher(new URL(path, url), {
      ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': BINARY_CONTENT_TYPE },
        body: encodeWire('rpc', body) }),
      credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000)
    })
    const result = await readBinaryResponse(response, maxBytes)
    if (!response.ok) throw new Error(`Node returned HTTP ${response.status}: ${result?.error || 'request failed'}`)
    return result
  }
  const expected = await createChainIdentity('leofcoin:peach', addresses)
  const identity = await verifyChainIdentity(await fetchBinary('chainIdentity'))
  if (identity.chainId !== expected.chainId || identity.network !== expected.network)
    throw new Error('Peach chain identity differs from this workspace; no pool data accepted')
  const rpc = (action, fields = {}) => fetchBinary('manager/rpc', { action, chainId: identity.chainId, ...fields })
  const explorer = (resource, fields = {}) => fetchBinary(`explorer/${resource}`,
    { chainId: identity.chainId, ...fields }, resource === 'block' ? 1_050_000 : 65536)
  const status = await rpc('status')
  if (status.chainId !== identity.chainId || status.network !== identity.network ||
      status.nativeToken !== identity.genesisContracts.nativeToken)
    throw new Error('Node status does not match the verified chain identity')
  if (status.synced !== true || !Number.isSafeInteger(status.peers) || status.peers < 1)
    throw new Error('Node is not synced and connected; live price unavailable')
  const overview = await explorer('status')
  if (overview.chainId !== identity.chainId || !hashPattern.test(overview.tip?.hash))
    throw new Error('Explorer tip does not match the verified chain identity')
  const block = await explorer('block', { hash: overview.tip.hash })
  if (block.chainId !== identity.chainId || !(block.encoded instanceof Uint8Array))
    throw new Error('Invalid explorer tip block')
  const tip = new BlockMessage(block.encoded)
  if (await tip.hash() !== overview.tip.hash || !isBlockProtocolCompatible(tip.decoded.protocolVersion, PROTOCOL_VERSION))
    throw new Error(`Node tip is invalid or incompatible with protocol ${PROTOCOL_VERSION}`)
  const read = async (contract, method) => {
    const result = await rpc('read', { contract, method, params: [] })
    if (!result || typeof result !== 'object' || !('value' in result))
      throw new Error(`Invalid ${method} response`)
    return result.value
  }
  const [token0, token1, reserves, decimals, symbol, fee] = await Promise.all([
    read(pool, 'token0'), read(pool, 'token1'), read(pool, 'reserves'),
    read(testEuro, 'decimals'), read(testEuro, 'symbol'), read(pool, 'feeBasisPoints')
  ])
  const native = identity.genesisContracts.nativeToken
  if (testEuro === native || token0 === token1 ||
      !((token0 === native && token1 === testEuro) || (token1 === native && token0 === testEuro)))
    throw new Error('Pool is not the selected native LFC/tEUR pair')
  if (symbol !== 'tEUR') throw new Error('Selected token is not labelled tEUR')
  const decimalPlaces = Number(integer(decimals, 'tEUR decimals'))
  if (!Number.isSafeInteger(decimalPlaces) || decimalPlaces > 18) throw new Error('Unsupported tEUR decimals')
  const feeBasisPoints = integer(fee, 'pool fee')
  if (feeBasisPoints >= 10000n || !Array.isArray(reserves) || reserves.length !== 2)
    throw new Error('Invalid pool reserves or fee')
  const lfc = integer(reserves[token0 === native ? 0 : 1], 'LFC reserve')
  const eur = integer(reserves[token0 === native ? 1 : 0], 'tEUR reserve')
  if (lfc === 0n || eur === 0n) throw new Error('Pool has no two-sided liquidity')
  const price = eur * 10n ** 18n * 100_000_000n / (lfc * 10n ** BigInt(decimalPlaces))
  return {
    observedAt: new Date().toISOString(), chainId: identity.chainId, pool, testEuro,
    protocolVersion: tip.decoded.protocolVersion,
    reportedHeight: String(integer(status.height, 'height')),
    lfc: decimal(lfc, 18), tEUR: decimal(eur, decimalPlaces),
    spotTEurPerLfc: price === 0n ? '<0.00000001' : decimal(price, 8),
    feeBasisPoints: String(feeBasisPoints),
    warning: 'Test tokens only; not real EUR, a reliable oracle, or proof of value creation. Node data is not independently verified; reads are not block-pinned.'
  }
}

async function main() {
  const args = process.argv.slice(2)
  let endpoint = 'https://remote.leofcoin.org/', pool, testEuro, once = false
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--once') { once = true; continue }
    if (!['--endpoint', '--pool', '--teur'].includes(args[index]) || !args[index + 1])
      throw new Error('Usage: node scripts/watch-testnet-pool.js --pool HASH --teur HASH [--endpoint URL] [--once]')
    const flag = args[index++]
    if (flag === '--endpoint') endpoint = args[index]
    else if (flag === '--pool') pool = args[index]
    else testEuro = args[index]
  }
  if (!pool || !testEuro)
    throw new Error('Usage: node scripts/watch-testnet-pool.js --pool HASH --teur HASH [--endpoint URL] [--once]')
  do {
    console.log(JSON.stringify(await readTestnetPool({ endpoint, pool, testEuro })))
    if (!once) await sleep(10_000)
  } while (!once)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(error => { console.error(`Testnet pool monitor: ${error.message}`); process.exitCode = 1 })
