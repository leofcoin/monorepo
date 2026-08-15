import koa from 'koa'
import cors from '@koa/cors'
import Router from '@koa/router'
import { formatUnits, jsonStringifyBigInt } from '@leofcoin/utils'
import { readFile } from 'fs/promises'
import Showdown from 'showdown'
import shared from './shared.js'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const api = new koa()
const router = new Router()

const converter = new Showdown.Converter()
const apiFile = await readFile(join(__dirname, './api.md'))

/**
 *
 * ensure remote is set to false when serving on a server
 */
export default (chain, port, networkVersion, remote: boolean = false) => {
  // api routes
  router.get('/', (ctx) => {
    ctx.body = converter.makeHtml(apiFile.toString())
  })

  router.get('/network', (ctx) => {
    ctx.body = {
      version: networkVersion
    }
  })

  router.get('/networkStats', async (ctx) => {
    ctx.body = await shared.networkStats(chain, networkVersion)
  })

  router.get('/balances', async (ctx) => {
    ctx.body = await chain.balances
  })

  router.get('/balanceOf', async (ctx) => {
    // @ts-ignore
    const balance = (await chain.balances)[ctx.query.address]
    if (balance) ctx.body = ctx.query.format ? formatUnits(balance).toString() : balance.toString()
    else ctx.body = '0n'
  })

  router.get('/selectedAccount', (ctx) => {
    if (remote) ctx.body = globalThis.peernet.selectedAccount
    else ctx.status = 405
  })

  router.get('/selectAccount', async (ctx) => {
    if (remote) {
      globalThis.peernet.selectedAccount = ctx.query.address
      try {
        await globalThis.walletStore.put('selected-account', ctx.query.address)
      } catch (error) {
        ctx.body = error.message
      }
    } else {
      ctx.status = 405
    }
  })

  router.get('/accounts', async (ctx) => {
    if (remote) ctx.body = JSON.parse(new TextDecoder().decode(await globalThis.walletStore.get('accounts')))
    else ctx.status = 405
  })

  router.get('/hasTransactionToHandle', async (ctx) => {
    ctx.body = await chain.hasTransactionToHandle()
  })

  router.get('/getNonce', async (ctx) => {
    ctx.body = await chain.getNonce(ctx.query.address)
  })

  router.get('/getBlock', async (ctx) => (ctx.body = await chain.getBlock(ctx.query.index)))

  router.get('/blocks', async (ctx) => {
    const limit = ctx.query.amount
    ctx.body = await globalThis.blockStore.values(limit)
  })

  router.get('/sendTransaction', async (ctx) => {
    try {
      const tx = await chain.sendTransaction(ctx.query.transaction)
      await tx.wait()
      delete tx.wait
      ctx.body = JSON.stringify(tx, jsonStringifyBigInt)
    } catch (error) {
      // ctx(202)
    }
  })

  router.get('/peerId', (ctx) => (ctx.body = globalThis.peernet.peerId))

  router.get('/validators', (ctx) => (ctx.body = chain.validators))

  router.get('/peers', (ctx) => (ctx.body = globalThis.peernet.peers.map(([id, peer]) => id)))

  router.get('/lookup', async (ctx) => {
    ctx.body = await chain.lookup(ctx.query.name)
  })

  router.get(
    '/staticCall',
    async (ctx) => (ctx.body = await chain.staticCall(ctx.query.contract, ctx.query.method, ctx.query.params))
  )
  router.get('/contracts', async (ctx) => (ctx.body = await chain.contracts))

  router.get('/totalContracts', async (ctx) => (ctx.body = await chain.totalContracts))

  router.get('/nativeToken', async (ctx) => (ctx.body = await chain.nativeToken))

  router.get('/nativeCalls', async (ctx) => (ctx.body = await chain.nativeCalls))

  router.get('/nativeMints', async (ctx) => (ctx.body = await chain.nativeMints))

  router.get('/nativeBurns', async (ctx) => (ctx.body = await chain.nativeBurns))

  router.get('/nativeTransfers', async (ctx) => (ctx.body = await chain.nativeTransfers))

  router.get('/totalBurnAmount', async (ctx) => (ctx.body = await chain.totalBurnAmount))

  router.get('/totalMintAmount', async (ctx) => (ctx.body = await chain.totalMintAmount))

  router.get('/totalTransferAmount', async (ctx) => (ctx.body = await chain.totalTransferAmount))

  router.get('/totalTransactions', async (ctx) => (ctx.body = await chain.totalTransactions))

  router.get('/totalSize', async (ctx) => (ctx.body = await chain.totalSize))

  router.get('/totalBlocks', async (ctx) => (ctx.body = await chain.totalBlocks))

  router.get('/lastBlock', async (ctx) => (ctx.body = await chain.lastBlock))

  router.get('/lastBlockHeight', async (ctx) => (ctx.body = await chain.lastBlockHeight))

  router.get('/poolTransactions', async (ctx) => (ctx.body = await globalThis.transactionPoolStore.get()))

  router.get('/transactionsInPool', async (ctx) => (ctx.body = await globalThis.transactionPoolStore.length()))

  router.get('/transactionPoolSize', async (ctx) => (ctx.body = await globalThis.transactionPoolStore.size()))

  router.get('/participating', (ctx) => (ctx.body = chain.participating))

  router.get('/participate', async (ctx) => {
    if (remote) ctx.body = await chain.participate(ctx.query.address)
    else ctx.status = 405
  })

  router.get('/deployContract', async (ctx) => {
    try {
      const tx = await chain.deployContract(ctx.query.contract, ctx.query.transaction)
      await tx.wait()
      delete tx.wait
      ctx.body = JSON.stringify(tx, jsonStringifyBigInt)
    } catch (error) {
      ctx.body = error.mesage
    }
  })

  router.get('/createContractAddress', async (ctx) => {
    try {
      const address = await chain.createContractAddress(ctx.query.owner, ctx.query.code, ctx.query.params)
      ctx.body = address
    } catch (error) {}
  })

  router.get('/blockHashMap', async (ctx) => (ctx.body = chain.blockHashMap))

  router.get('/bootstrap', async (ctx) => {
    ctx.body = (await shared.bootstrap()).map((value) => Array.from(value.toString()))
  })

  // todo finish ...
  api.use(cors({ origin: '*' }))
  api.use(router.routes())
  api.listen(port)
}
