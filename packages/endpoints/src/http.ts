import { binaryHttp } from './binary-http.js'
import koa from 'koa'
import cors from '@koa/cors'
import Router from '@koa/router'
import { formatUnits } from '@leofcoin/utils'
import { readFile } from 'fs/promises'
import Showdown from 'showdown'
import shared from './shared.js'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { managerMiddleware } from './manager.js'
import { explorerMiddleware } from './explorer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const converter = new Showdown.Converter()
const apiFile = await readFile(join(__dirname, './api.md'))

/**
 *
 * ensure remote is set to false when serving on a server
 */
export default (chain, port, networkVersion, remote: boolean = false) => {
  const api = new koa()
  const router = new Router()
  // api routes
  router.get('/', (ctx) => {
    ctx.body = converter.makeHtml(apiFile.toString())
  })

  router.all('/network', (ctx) => {
    ctx.body = {
      version: networkVersion
    }
  })

  router.all('/chainIdentity', async (ctx) => {
    ctx.body = await chain.getChainIdentity()
  })

  router.all('/networkStats', async (ctx) => {
    ctx.body = await shared.networkStats(chain, networkVersion)
  })

  router.all('/balances', async (ctx) => {
    ctx.body = await chain.balances
  })

  router.all('/balanceOf', async (ctx) => {
    // @ts-ignore
    const balance = (await chain.balances)[ctx.state.rpcParams.address]
    if (balance) ctx.body = ctx.state.rpcParams.format ? formatUnits(balance).toString() : balance.toString()
    else ctx.body = '0n'
  })

  router.all('/selectedAccount', (ctx) => {
    if (remote) ctx.body = globalThis.peernet.selectedAccount
    else ctx.status = 405
  })

  router.all('/selectAccount', async (ctx) => {
    if (remote) {
      globalThis.peernet.selectedAccount = ctx.state.rpcParams.address
      try {
        await globalThis.walletStore.put('selected-account', ctx.state.rpcParams.address)
      } catch (error) {
        ctx.body = error.message
      }
    } else {
      ctx.status = 405
    }
  })

  router.all('/accounts', async (ctx) => {
    if (remote) ctx.body = JSON.parse(new TextDecoder().decode(await globalThis.walletStore.get('accounts')))
    else ctx.status = 405
  })

  router.all('/hasTransactionToHandle', async (ctx) => {
    ctx.body = await chain.hasTransactionToHandle()
  })

  router.all('/getNonce', async (ctx) => {
    ctx.body = await chain.getNonce(ctx.state.rpcParams.address)
  })

  router.all('/getBlock', async (ctx) => (ctx.body = await chain.getBlock(ctx.state.rpcParams.index)))

  router.all('/blocks', async (ctx) => {
    const limit = ctx.state.rpcParams.amount
    ctx.body = await globalThis.blockStore.values(limit)
  })

  router.all('/sendTransaction', async (ctx) => {
    try {
      const tx = await chain.sendTransaction((ctx.state.rpcParams.transaction ?? ctx.state.rpcParams))
      await (typeof tx.wait === 'function' ? tx.wait() : tx.wait)
      delete tx.wait
      ctx.body = tx
    } catch (error) {
      ctx.status = 422
      ctx.body = { error: error instanceof Error ? error.message : 'Transaction failed' }
    }
  })

  router.all('/peerId', (ctx) => (ctx.body = globalThis.peernet.peerId))

  router.all('/validators', (ctx) => (ctx.body = chain.validators))

  router.all('/peers', (ctx) => (ctx.body = globalThis.peernet.peers.map(([id, peer]) => id)))

  router.all('/lookup', async (ctx) => {
    ctx.body = await chain.lookup(ctx.state.rpcParams.name)
  })

  router.all(
    '/staticCall',
    async ctx => {
      let params
      try {
        params = ctx.state.rpcParams.params ?? []
        if (!Array.isArray(params) || typeof ctx.state.rpcParams.contract !== 'string' || typeof ctx.state.rpcParams.method !== 'string') throw new Error('Invalid read parameters')
      } catch {
        ctx.status = 400
        ctx.body = { error: 'staticCall params must be a binary array' }
        return
      }
      try {
        const value = await chain.staticCall(ctx.state.rpcParams.contract, ctx.state.rpcParams.method, params)
        ctx.body = value ?? null
      } catch (error) {
        ctx.status = 422
        ctx.body = { error: error instanceof Error ? error.message : 'Read-only contract query failed' }
      }
    }
  )
  router.all('/contracts', async (ctx) => (ctx.body = await chain.contracts))

  router.all('/totalContracts', async (ctx) => (ctx.body = await chain.totalContracts))

  router.all('/nativeToken', async (ctx) => (ctx.body = await chain.nativeToken))

  router.all('/nativeCalls', async (ctx) => (ctx.body = await chain.nativeCalls))

  router.all('/nativeMints', async (ctx) => (ctx.body = await chain.nativeMints))

  router.all('/nativeBurns', async (ctx) => (ctx.body = await chain.nativeBurns))

  router.all('/nativeTransfers', async (ctx) => (ctx.body = await chain.nativeTransfers))

  router.all('/totalBurnAmount', async (ctx) => (ctx.body = await chain.totalBurnAmount))

  router.all('/totalMintAmount', async (ctx) => (ctx.body = await chain.totalMintAmount))

  router.all('/totalTransferAmount', async (ctx) => (ctx.body = await chain.totalTransferAmount))

  router.all('/totalTransactions', async (ctx) => (ctx.body = await chain.totalTransactions))

  router.all('/totalSize', async (ctx) => (ctx.body = await chain.totalSize))

  router.all('/totalBlocks', async (ctx) => (ctx.body = await chain.totalBlocks))

  router.all('/lastBlock', async (ctx) => (ctx.body = await chain.lastBlock))

  router.all('/lastBlockHeight', async (ctx) => (ctx.body = await chain.lastBlockHeight))

  router.all('/poolTransactions', async (ctx) => (ctx.body = await globalThis.transactionPoolStore.get()))

  router.all('/transactionsInPool', async (ctx) => (ctx.body = await globalThis.transactionPoolStore.length()))

  router.all('/transactionPoolSize', async (ctx) => (ctx.body = await globalThis.transactionPoolStore.size()))

  router.all('/participating', (ctx) => (ctx.body = chain.participating))

  router.all('/participate', async (ctx) => {
    if (remote) ctx.body = await chain.participate(ctx.state.rpcParams.address)
    else ctx.status = 405
  })

  router.all('/deployContract', async (ctx) => {
    try {
      const tx = await chain.deployContract(ctx.state.rpcParams.contract, ctx.state.rpcParams.transaction)
      await (typeof tx.wait === 'function' ? tx.wait() : tx.wait)
      delete tx.wait
      ctx.body = tx
    } catch (error) {
      ctx.status = 422
      ctx.body = { error: error instanceof Error ? error.message : 'Deployment failed' }
    }
  })

  router.all('/createContractAddress', async (ctx) => {
    try {
      const address = await chain.createContractAddress(ctx.state.rpcParams.owner, ctx.state.rpcParams.code, ctx.state.rpcParams.params)
      ctx.body = address
    } catch (error) {}
  })

  router.all('/blockHashMap', async (ctx) => (ctx.body = chain.blockHashMap))

  router.all('/bootstrap', async (ctx) => {
    ctx.body = await shared.bootstrap()
  })

  // todo finish ...
  api.use(cors({ origin: '*' }))
  api.use(binaryHttp)
  api.use(explorerMiddleware(chain))
  api.use(managerMiddleware(chain))
  api.use(router.routes())
  return api.listen(port)
}
