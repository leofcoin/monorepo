import test from 'node:test'
import assert from 'node:assert/strict'
import { chainDiscoveryOptions, chainPeernetOptions, assertDiscoveryNamespace, chainNetwork } from '../../exports/star-namespace.js'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import addresses from '@leofcoin/addresses'

test('chain discovery binds the immutable bundled genesis before transport startup',async()=>{
  const result=await chainDiscoveryOptions({network:'leofcoin:peach'})
  assert.equal(typeof result.protocolVersion,'string')
  assert.equal(result.chainId,(await createChainIdentity(result.network,addresses)).chainId)
  assert.match(chainPeernetOptions(await chainDiscoveryOptions({network:'leofcoin:mainnet'})).network,/:mainnet$/)
  const legacy=await chainDiscoveryOptions({network:'leofcoin:peach',networkVersion:'peach',version:result.protocolVersion})
  assert.deepEqual(legacy,result)
  const routing=chainPeernetOptions(result)
  assert.match(routing.network,/^[0-9a-f-]{36}:peach$/)
  assert.equal(routing.root,'.leofcoin/peach')
  assert.equal(chainNetwork('fallback',{ledgerNetwork:result.network,network:routing.network}),result.network)
  assert.equal((await createChainIdentity(chainNetwork('fallback',{ledgerNetwork:result.network,network:routing.network}),addresses)).chainId,result.chainId)
  assert.equal(chainPeernetOptions({...result,root:'.existing-wallet'}).root,'.existing-wallet')
  for(const field of ['protocol','version','networkVersion','discoveryNetwork']){
    assert.equal(Object.hasOwn(routing,field),false);assert.equal(Object.hasOwn(result,field),false)
  }
  assert.equal(chainPeernetOptions({...result,protocolVersion:'other'}).network,routing.network)
  assert.doesNotThrow(()=>assertDiscoveryNamespace({namespace:routing},result))
  assert.throws(()=>assertDiscoveryNamespace({},result),/network-isolated Peernet/)
  await assert.rejects(chainDiscoveryOptions({chainId:'lfc:wrong'}),/bundled genesis/)
  await assert.rejects(chainDiscoveryOptions({protocol:'files'}),/network and protocolVersion/)
  await assert.rejects(chainDiscoveryOptions({protocolVersion:'wrong'}),/version mismatch/)
  await assert.rejects(chainDiscoveryOptions({network:'leofcoin:peach',networkVersion:'mainnet'}),/conflicts/)
})
