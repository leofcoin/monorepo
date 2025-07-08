import { signTransaction } from '@leofcoin/lib'
import networks from '@leofcoin/networks'

globalThis.createDebugger = (ta) => {
  return (t) => {
    console.log(`${ta}: ${t}`)
  }
}

import { readFile } from 'fs/promises'
import { formatUnits, parseUnits } from '../../utils/exports/utils.js'
let password
try {
  password = (await readFile('./.password.txt')).toString()
} catch (error) {
  console.log(error)
}

globalThis.DEBUG = ['peernet', 'netpeer/swarm/client', 'leofcoin']
const Chain = await import('../exports/chain.js')
const Node = await import('../exports/node.js')

const node = await new Node.default(
  {
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'peach',
    version: '0.1.0',
    stars: networks.leofcoin.peach.stars,
    autoStart: false,
    password
  },
  password
)
console.time('load chain')
const chain = await new Chain.default({
  password
})
console.timeEnd('load chain')
let start
// console.log(peernet.identity.sign());

await chain.participate(peernet.selectedAccount)
console.log(peernet.selectedAccount)
// const job = async () => {

let nonce = await chain.getNonce(peernet.selectedAccount)

const fiveSecondDelay = () =>
  new Promise((resolve) => {
    setTimeout(() => resolve(), 5000)
  })
// // setTimeout(async () => {
let hasTransactionsInPool

try {
  hasTransactionsInPool = (await transactionPoolStore.length()) > 0
} catch (error) {
  hasTransactionsInPool = false
}

console.log({
  hasTransactionsInPool
})

console.log({ nonce })

console.log(Object.keys(await chain.balances).length === 0)

console.log(await chain.balances)

if (Object.keys(await chain.balances).length === 0 && !hasTransactionsInPool) {
  let transactions = [
    {
      from: peernet.selectedAccount,
      to: chain.nativeToken,
      nonce: 2,
      priority: true,
      method: 'mint',
      params: [peernet.selectedAccount, parseUnits('100000000000000')]
    },
    {
      from: peernet.selectedAccount,
      to: chain.nativeToken,
      method: 'grantRole',
      nonce: 1,
      priority: true,
      params: [peernet.selectedAccount, 'MINT']
    }
  ]
  let tx
  try {
    transactions = await Promise.all(transactions.map((tx) => chain.createTransaction(tx)))
    transactions = await Promise.all(transactions.map((tx) => signTransaction(tx, peernet.identity)))
    transactions = await Promise.all(transactions.map((tx) => chain.sendTransaction(tx)))
    transactions = await Promise.all(transactions.map((tx) => tx.wait))
    await fiveSecondDelay()
  } catch (e) {
    console.warn(e)
    throw e
  }
}

//   console.log({nonce});
let balances = await chain.balances

let promises = []
nonce = await chain.getNonce(peernet.selectedAccount)

for (let i = 0; i < 10; i++) {
  // contract , method, from, to, amount, (optional) nonce
  nonce += 1
  const rawTransaction = await chain.createTransaction({
    from: peernet.selectedAccount,
    to: chain.nativeToken,
    method: 'transfer',
    nonce,
    params: [peernet.selectedAccount, 'YTqxts7awrjHjYwNNnLugbDp2BMqAhCXGnGvhJYMPL6iBCWJAcbaj', parseUnits('0.000001')]
  })
  const transaction = await signTransaction(rawTransaction, peernet.identity)
  promises.push(transaction)
}
console.time('transactions created')
promises = await Promise.allSettled(promises.map((transaction) => chain.sendTransaction(transaction)))
console.timeEnd('transactions created')
console.time('transactions handled')
promises = await Promise.allSettled(promises.map(({ value }) => value.wait))
console.timeEnd('transactions handled')

setTimeout(() => {
  let formatedBalances = {}
  for (const key in balances) {
    formatedBalances[key] = formatUnits(balances[key])
  }
  console.log(formatedBalances)
}, 1000)

const exported = await peernet.identity.export('password')
const exportedQR = await globalThis.peernet.identity.exportQR('password')
console.log(peernet.identity)
console.log(exported)
console.log(exportedQR)
//       // job()
//   // }, 5000);
// // }

// // setTimeout(function () {
// //   start = new Date().getTime()
// //   console.log(peernet.connections);
// // }, 10000);
//   // try {
//   //   job()
//   // } catch (e) {
//   //   console.warn(e);
//   // }
