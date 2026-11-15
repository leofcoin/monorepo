import assert from 'node:assert/strict'
import test from 'node:test'
import addresses from '@leofcoin/addresses'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { chainNameForIdentity, shortChainId } from '../src/chain-names.js'

const peachIdentity = await createChainIdentity('leofcoin:peach', addresses)

test('chain names use the verified identity namespace instead of pinned hashes', async () => {
  const mainnet = await createChainIdentity('leofcoin:mainnet', addresses)
  assert.equal(chainNameForIdentity(peachIdentity), 'Peach testnet')
  assert.equal(chainNameForIdentity(mainnet), 'Mainnet (experimental)')
  assert.equal(chainNameForIdentity({ network: 'unlisted' }), undefined)
})

test('chain ID display is short but retains a recognizable prefix and suffix', () => {
  assert.equal(shortChainId(peachIdentity.chainId),
    `${peachIdentity.chainId.slice(0, 14)}…${peachIdentity.chainId.slice(-8)}`)
  assert.equal(shortChainId(''), '')
})
