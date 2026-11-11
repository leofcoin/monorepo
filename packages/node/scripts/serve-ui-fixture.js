import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { build } from 'esbuild'
import addresses from '@leofcoin/addresses'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { jsonStringifyBigInt } from '@leofcoin/utils'
import { explorerMiddleware } from '../../endpoints/exports/explorer.js'
import { explorerFixture } from '../test/explorer-fixture-data.js'

const root = resolve('www')
const fixture = resolve('test/wallet-ui-fixture.html')
const shellFixture = resolve('test/shell-ui-fixture.html')
let explorerFixtureBundle
let publicFixture
const port = Number(process.env.UI_FIXTURE_PORT || 9556)
const types = {
  '.js': 'text/javascript',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
}
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
    if (pathname.startsWith('/explorer/')) {
      publicFixture ||= (async () => {
        const data = await explorerFixture('fixture-public-address', addresses.nativeToken)
        globalThis.blockStore = { has: async hash => data.blockBytes.has(hash), get: async hash => data.blockBytes.get(hash) }
        globalThis.transactionStore = data.transactionStore
        globalThis.transactionPoolStore = { ...data.transactionPoolStore, length: async () => 1, size: async () => 224 }
        globalThis.peernet = { connections: {} }
        const identity = await createChainIdentity('leofcoin:peach', addresses)
        return explorerMiddleware({ getChainIdentity: async () => identity, lastBlock: data.blocks.at(-1),
          getBlocks: async (from, to) => data.blocks.slice(from, to), state: { sync: 'synced' },
          staticCall: async (_, method) => method === 'validators' ? ['fixture-public-address'] : 3,
          nativeCalls: 65n, nativeMints: 1n, nativeBurns: 0n, nativeTransfers: 64n,
          totalContracts: 3n, totalTransactions: 65n, totalSize: 100000,
          balances: { 'fixture-public-address': 1000n * 10n ** 18n } })
      })()
      const ctx = { path: pathname, method: request.method, query: Object.fromEntries(new URL(request.url, 'http://localhost').searchParams),
        status: 200, body: null, set: (name, value) => response.setHeader(name, value) }
      await (await publicFixture)(ctx, () => {})
      response.writeHead(ctx.status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(ctx.body, jsonStringifyBigInt))
      return
    }
    if (pathname === '/fixture-explorer.js') {
      // Bundle once per server process; restarting invalidates fixture/dependency inputs.
      explorerFixtureBundle ||= build({ entryPoints: [resolve('test/explorer-fixture-data.js')], bundle: true,
        write: false, platform: 'browser', format: 'esm', target: 'es2022' })
      const result = await explorerFixtureBundle
      response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' })
      response.end(result.outputFiles[0].text)
      return
    }
    const target = pathname === '/' ? fixture : pathname === '/console' ? shellFixture : resolve(root, pathname.replace(/^\/+/, ''))
    if (target !== fixture && target !== shellFixture && !target.startsWith(root + sep)) {
      response.writeHead(403)
      response.end()
      return
    }
    const body = await readFile(target)
    response.writeHead(200, {
      'Content-Type': types[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`UI fixtures: http://localhost:${port} (no real node or transactions)`)
)
