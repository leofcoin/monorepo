import nodeConfig from './../node_modules/@leofcoin/lib/src/node-config.js'
import Node from './../node_modules/@leofcoin/chain/dist/node.js'
import Chain from './../node_modules/@leofcoin/chain/dist/chain.js';


(async () => {
  console.log(Node);
  const node = await new Node({
    network: 'leofcoin:mandarine'
  })
  await nodeConfig({
    network: 'leofcoin:mandarine'
  })
  const chain = await new Chain()
  let accounts = await walletStore.get('accounts')
  accounts = new TextDecoder().decode(accounts)

   // fixing account issue (string while needs to be a JSON)
   // TODO: remove when on mainnet
   try {
     accounts = JSON.parse(accounts)
   } catch (e) {
     accounts = [accounts.split(',')]
   }
   try {
     await chain.participate()
     console.log('ok');
   } catch (e) {
     console.log(e);
   }
  onmessage = async ({data}) => {
    if (!data.params) data.params = []
    if (data.type === 'chain') {

      let result
      console.log(typeof chain[data.method] === 'function' || typeof chain[data.method] === 'promise');
      if (typeof chain[data.method] === 'function' || typeof chain[data.method] === 'promise') {
        result = await chain[data.method](...data.params)
      } else {
        result = await chain[data.method]
      }
      return postMessage({id: data.id, data: result})
    }
    if (data.type === 'node')  {
      if (data.method === 'accounts') {
        return postMessage({id: data.id, data: accounts})
      } else {
        let result
        if (typeof peernet[data.method] === 'function') {
          result = await peernet[data.method]?.(...data.params)
        } else {
          result = await peernet[data.method]
        }
        return postMessage({id: data.id, data: result})
      }
    }
  }
 pubsub.publish('chain:ready', true)
})()
