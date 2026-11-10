import assert from 'node:assert/strict'
import test from 'node:test'
import Client from '../exports/direct.js'

test('direct stats report the chain protocol without removed Peernet aliases',async()=>{
  const previous=Object.fromEntries(['chain','peernet','accountsStore'].map(key=>[key,globalThis[key]]))
  try {
    globalThis.chain={version:'chain-wire-test',balances:Promise.resolve({})}
    globalThis.peernet={network:'app-id:public',protocolVersion:'transport-wire-test',peers:[]}
    globalThis.accountsStore={length:async()=>0}
    const stats=await new Client().networkStats()
    assert.equal(stats.version,globalThis.chain.version)
    assert.deepEqual(stats.peers,[])
  } finally {
    for(const[key,value]of Object.entries(previous)) {
      if(value===undefined)delete globalThis[key];else globalThis[key]=value
    }
  }
})
