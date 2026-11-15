import assert from 'node:assert/strict'
import test from 'node:test'
import addresses from '@leofcoin/addresses'
import { encodeWire, decodeWire, BINARY_CONTENT_TYPE } from '@leofcoin/binary'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { BlockMessage } from '@leofcoin/messages'
import { readTestnetPool } from '../scripts/watch-testnet-pool.js'

const pool = 'A'.repeat(52)
const testEuro = 'B'.repeat(52)
const identity = await createChainIdentity('leofcoin:peach', addresses)
const makeTip = version => new BlockMessage({
  index: 10n, previousHash: '0x0', timestamp: 1000, reward: 0n, fees: 0n,
  transactions: [], validators: [], producer: 'test', producerProof: 'test', protocolVersion: version
})
const response = value => new Response(encodeWire('rpc', value),
  { headers: { 'Content-Type': BINARY_CONTENT_TYPE } })
const fixture = (overrides = {}) => async (url, options) => {
  if (new URL(url).pathname === '/chainIdentity') return response(overrides.identity ?? identity)
  const body = decodeWire('rpc', options.body)
  assert.equal(body.chainId, identity.chainId)
  const tip = makeTip(overrides.protocolVersion ?? '0.9.0')
  if (new URL(url).pathname === '/explorer/status')
    return response({ chainId: identity.chainId, tip: { hash: overrides.tipHash ?? await tip.hash(), index: 10n } })
  if (new URL(url).pathname === '/explorer/block')
    return response({ chainId: identity.chainId, encoded: tip.encoded })
  if (body.action === 'status') return response({
    chainId: identity.chainId, network: identity.network, nativeToken: addresses.nativeToken,
    synced: true, peers: 1, height: '10', ...overrides.status
  })
  const values = {
    token0: addresses.nativeToken, token1: testEuro,
    reserves: [1000n * 10n ** 18n, 100n * 10n ** 6n],
    decimals: 6, symbol: 'tEUR', feeBasisPoints: 30
  }
  return response({ value: (overrides.values ?? values)[body.method] })
}

test('reads labelled testnet reserves and handles token decimal differences', async () => {
  const result = await readTestnetPool({ endpoint: 'https://example.test/', pool, testEuro, fetcher: fixture() })
  assert.equal(result.spotTEurPerLfc, '0.10000000')
  assert.equal(result.reportedHeight, '10')
  assert.equal(result.tEUR, '100.000000')
  assert.match(result.warning, /not real EUR/)
  const reversed = await readTestnetPool({ endpoint: 'https://example.test/', pool, testEuro, fetcher: fixture({
    values: { token0: testEuro, token1: addresses.nativeToken,
      reserves: [100n * 10n ** 6n, 1000n * 10n ** 18n], decimals: 6, symbol: 'tEUR', feeBasisPoints: 30 }
  }) })
  assert.equal(reversed.spotTEurPerLfc, result.spotTEurPerLfc)
})

test('refuses different chains, disconnected nodes and wrong or empty pools', async () => {
  const otherIdentity = await createChainIdentity('leofcoin:other', addresses)
  for (const [options, expected] of [
    [{ identity: otherIdentity }, /identity differs/],
    [{ status: { peers: 0 } }, /not synced and connected/],
    [{ protocolVersion: '0.6.0' }, /incompatible with protocol/],
    [{ tipHash: 'A'.repeat(52) }, /tip is invalid/],
    [{ values: { token0: 'C'.repeat(52), token1: testEuro, reserves: [1n, 1n], decimals: 6, symbol: 'tEUR', feeBasisPoints: 30 } }, /not the selected/],
    [{ values: { token0: addresses.nativeToken, token1: testEuro, reserves: [0n, 1n], decimals: 6, symbol: 'tEUR', feeBasisPoints: 30 } }, /no two-sided liquidity/]
  ]) await assert.rejects(readTestnetPool({ endpoint: 'https://example.test/', pool, testEuro, fetcher: fixture(options) }), expected)
})
