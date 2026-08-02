import { signTransaction } from '@leofcoin/lib'
import networks from '@leofcoin/networks'
import { setTargets } from '@vandeurenglenn/debug'

setTargets(true)

import { readFile } from 'fs/promises'
import { formatUnits, parseUnits } from '../../utils/exports/utils.js'
let password
try {
  password = (await readFile('./.password.txt')).toString()
} catch (error) {
  console.log(error)
}

const Chain = await import('../exports/chain.js')
const Node = await import('../exports/node.js')

const node = new Node.default(
  {
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'peach',
    version: '0.2.0',
    stars: networks.leofcoin.peach.stars,
    autoStart: false,
    password
  },
  password
)
await node.ready

console.time('load chain')

const chain = new Chain.default({
  password
})

await chain.ready
console.log(chain.ready)

console.timeEnd('load chain')

// Wait a brief moment for chain to start init in background
await new Promise((resolve) => setTimeout(resolve, 100))

console.log('Chain created')
// Note: Chain initialization happens in the background.
// The chain.ready promise will resolve when init completes.
let start
// console.log(peernet.identity.sign());

await chain.participate(peernet.selectedAccount)
console.log(peernet.selectedAccount)
console.log('✅ Chain successfully initialized and participated!')

let nonce = await chain.getNonce(peernet.selectedAccount)
console.log('Current nonce:', nonce)
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
      nonce: nonce + 2,
      priority: true,
      method: 'mint',
      params: [peernet.selectedAccount, parseUnits('100000000000000')]
    },
    {
      from: peernet.selectedAccount,
      to: chain.nativeToken,
      method: 'grantRole',
      nonce: nonce + 1,
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
console.log('Getting balances...')
const getBalancesWithTimeout = () =>
  Promise.race([
    chain.balances,
    new Promise((_, reject) => setTimeout(() => reject(new Error('balances timeout')), 5000))
  ])

let balances
try {
  balances = await getBalancesWithTimeout()
} catch (error) {
  console.warn('Failed to get balances:', error.message)
  balances = {}
}

console.log('Balances retrieved, continuing...')

let promises = []

for (let i = 0; i < 1; i++) {
  // contract , method, from, to, amount, (optional) nonce
  nonce += 1
  const rawTransaction = await chain.createTransaction({
    from: peernet.selectedAccount,
    to: chain.nativeToken,
    method: 'transfer',
    nonce,
    params: [peernet.selectedAccount, 'YTqxZpWaSDPV1cmediYrvSrdByA1qwx7hBw9WrbCiVMYJf5Q3fPYK', parseUnits('100')]
  })
  const transaction = await signTransaction(rawTransaction, peernet.identity)
  promises.push(transaction)
}
console.time('transactions created')
promises = await Promise.allSettled(promises.map((transaction) => chain.sendTransaction(transaction)))
console.log('Transactions sent, waiting for confirmations...')

promises
  .filter(({ status }) => status !== 'fulfilled')
  .map(({ value, reason }) => reason && console.warn('Transaction failed to send:', reason))

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
