import { signTransaction } from '@leofcoin/lib'
import { TransactionMessage } from '@leofcoin/messages'
import networks from '@leofcoin/networks'
globalThis.createDebugger = (ta) => {
  return (t) => {
    console.log(`${ta}: ${t}`)
  }
}

import { readFile } from 'fs/promises'
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
    version: '1.2.1',
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
  hasTransactionsInPool = (await transactionPoolStore.length) > 0
} catch (error) {
  hasTransactionsInPool = false
}

console.log(await chain.balances)
console.log(Object.keys(await chain.balances))
if (Object.keys(await chain.balances).length === 0 && !hasTransactionsInPool) {
  let transactions = [
    {
      from: peernet.selectedAccount,
      to: chain.nativeToken,
      nonce: 2,
      priority: true,
      method: 'mint',
      params: [peernet.selectedAccount, chain.utils.parseUnits('100000000000000').toString()]
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
    throw e
  }
}

//   console.log({nonce});
let balances = await chain.balances
console.log({ balances })

// return setTimeout(() => {}, 60000)
// console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
// console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
// return
let promises = []
nonce = await chain.getNonce(peernet.selectedAccount)
console.log(nonce)

for (let i = 0; i < 1000; i++) {
  // contract , method, from, to, amount, (optional) nonce
  nonce += 1
  const rawTransaction = await chain.createTransaction({
    from: peernet.selectedAccount,
    to: chain.nativeToken,
    method: 'transfer',
    nonce,
    params: [
      peernet.selectedAccount,
      'YTqy6AFqP3arS8nKu7JtdkuB6RpB8fTHBBioNiQMUQB6Vw9mXuhoQ',
      chain.utils.parseUnits('10').toString()
    ]
  })
  const transaction = await signTransaction(rawTransaction, peernet.identity)
  promises.push(transaction)
}
console.time('transactions handled')
promises = await Promise.allSettled(promises.map((transaction) => chain.sendTransaction(transaction)))

promises = await Promise.allSettled(promises.map(({ value }) => value.wait))
console.timeEnd('transactions handled')

// balances = await chain.balances
// console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
// console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);

// let d = await peernet.get('BA5XCAC6ILRTE7VHMCTCOTLWFRSY56IALYN4TXIJ37RWLFFC6OFW5MWVJA')
// console.log({d});
// return setTimeout(() => {}, 600000)
//     // setTimeout(async () => {
// promises = []
// nonce = await chain.getNonce(peernet.selectedAccount)
// // nonce += 1
// for (let i = 0; i < 10; i++) {
//   // contract , method, from, to, amount, (optional) nonce
//   nonce += 1
//   const rawTransaction = await chain.createTransaction({
//     from: peernet.selectedAccount,
//     to: chain.nativeToken,
//     method: 'transfer',
//     nonce,
//     params: [peernet.selectedAccount, 'YTqx4M6m1tEfJCD9Xah3i1igJuR6eZCZdHoZ7wvKyAns1e2NqSFDx', chain.utils.parseUnits('100').toString()]
//   })
//   const transaction = await signTransaction(rawTransaction, peernet.identity)
//   if (i === 0) console.log(transaction);
//   promises.push(chain.sendTransaction(transaction))
// }
//     promises = await Promise.allSettled(promises)
//     console.log({promises});
//     promises = await Promise.allSettled(promises.map(({value}) => value.wait))
//     balances = await chain.balances
//     console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
//     console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);

//     promises = []
//     nonce = await chain.getNonce(peernet.selectedAccount)

//     const createSignSendTransaction = async (nonce) => {
//       const rawTransaction = await chain.createTransaction({
//         from: peernet.selectedAccount,
//         to: chain.nativeToken,
//         method: 'transfer',
//         nonce,
//         params: [peernet.selectedAccount, 'YTqzu5jCU98Krtdaa9LADuBaicZ91UrJWMVaJNm5AKSoteca4DYXa', chain.utils.parseUnits('100').toString()]
//       })
//       const transaction = await signTransaction(rawTransaction, peernet.identity)
//       return chain.sendTransaction(transaction)
//     }
//     // nonce += 1
//     for (let i = 0; i < 100; i++) {
//       nonce += 1
//       promises.push(createSignSendTransaction(nonce))
//     }
//     promises = await Promise.allSettled(promises)
//     promises = await Promise.allSettled(promises.map(({value}) => value.wait))
//     balances = await chain.balances
//     console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
//     console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
//       // }, 10000);
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
