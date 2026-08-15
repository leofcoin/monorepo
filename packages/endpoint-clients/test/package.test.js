import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const publicMethods = [
  'accounts',
  'balanceOf',
  'balances',
  'blocks',
  'contracts',
  'createContractAddress',
  'deployContract',
  'getBlock',
  'getNonce',
  'hasTransactionToHandle',
  'lastBlock',
  'lastBlockHeight',
  'lookup',
  'network',
  'networkStats',
  'participate',
  'participating',
  'peerId',
  'peers',
  'poolTransactions',
  'sendTransaction',
  'staticCall',
  'totalBlocks',
  'totalContracts',
  'totalSize',
  'totalTransactions',
  'transactionPoolSize',
  'transactionsInPool',
  'validators'
]

test('exports importable clients with declarations and a shared API', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )

  for (const name of ['http', 'ws', 'direct']) {
    const entry = manifest.exports[`./${name}`]
    await readFile(new URL(`../${entry.types}`, import.meta.url), 'utf8')
    const Client = (await import(`../exports/${name}.js`)).default
    for (const method of publicMethods) {
      assert.equal(typeof Client.prototype[method], 'function', `${name}.${method}`)
    }
  }
})
