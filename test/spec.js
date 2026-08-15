export const implementations = [
  'accounts',
  'balanceOf',
  'balances',
  'blocks',
  'contracts',
  'createContractAddress',
  'createTransactionFrom',
  'deployContract',
  'getBlock',
  'hasTransactionToHandle',
  'lookup',
  'nativeBurns',
  'nativeCalls',
  'nativeMints',
  'nativeToken',
  'nativeTransfers',
  'participate',
  'participating',
  'peerId',
  'peers',
  'pubsub',
  'selectAccount',
  'selectedAccount',
  'staticCall',
  'totalBlocks',
  'totalSize',
  'totalTransactions',
  'validators',
  'lastBlock'
]

export const needsImplementations = (client) => {
  const needs = []
  for (const key of implementations)  {
    try {
      if (!client[key] && key === 'pubsub' && !client.isHttpClient) needs.push(key)  
    } catch (error) {
      if (error.message !== "Cannot read properties of undefined (reading 'pubsub')") throw new Error(error)
    }
    
  }
  console.log(needs);
  return needs
}