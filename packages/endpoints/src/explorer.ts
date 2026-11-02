import { BlockMessage, TransactionMessage } from '@leofcoin/messages'
import { verifyChainIdentity } from '@leofcoin/lib/chain-identity'

const fail = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }) }
const integer = (value, maximum: number) => {
  if (!/^(0|[1-9]\d*)$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum)
    fail(400, 'Invalid explorer range')
  return Number(value)
}
const hashInput = value => {
  if (typeof value !== 'string' || !/^[A-Z2-7]{32,128}$/.test(value)) fail(400, 'Invalid content hash')
  return value
}

/** Public data only. No wallet, account selection, signing, submission or peer fetches. */
export function explorerMiddleware(chain) {
  return async (ctx, next) => {
    if (!ctx.path.startsWith('/explorer/')) return next()
    ctx.set('Cache-Control', 'no-store')
    if (ctx.method !== 'POST') { ctx.status = 405; ctx.body = { error: 'Explorer supports read-only binary POST requests' }; return }
    let timer
    try {
      const body = await Promise.race([
        (async () => {
          const identity = await verifyChainIdentity(await chain.getChainIdentity())
          if (ctx.path !== '/explorer/status' && ctx.state.rpcParams.chainId !== identity.chainId)
            fail(409, 'Explorer chain identity changed; reconnect')
          const response = { apiVersion: 1, chainId: identity.chainId }
          if (ctx.path === '/explorer/status') {
            const tip = await chain.lastBlock
            return { ...response, identity, tip: { index: tip.index, hash: tip.hash },
              synced: chain.state?.sync === 'synced', nativeToken: identity.genesisContracts.nativeToken,
              peers: Object.entries(globalThis.peernet?.connections || {})
                .filter(([, peer]: [string, { connected?: boolean }]) => peer?.connected).map(([id]) => id).slice(0, 100) }
          }
          if (ctx.path === '/explorer/blocks') {
            const from = integer(ctx.state.rpcParams.from, Number.MAX_SAFE_INTEGER)
            const count = integer(ctx.state.rpcParams.count, 25)
            if (count < 1 || from > Number.MAX_SAFE_INTEGER - count) fail(400, 'Invalid explorer range')
            const blocks = await chain.getBlocks(from, from + count)
            if (!Array.isArray(blocks)) fail(503, 'Canonical block data unavailable')
            return { ...response, blocks: blocks.filter(block => block && block.loaded !== false) }
          }
          if (ctx.path === '/explorer/block' || ctx.path === '/explorer/transaction') {
            const hash = hashInput(ctx.state.rpcParams.hash)
            const stores = ctx.path === '/explorer/block' ? [globalThis.blockStore]
              : [globalThis.transactionStore, globalThis.transactionPoolStore]
            let bytes
            for (const store of stores) {
              if (store && await store.has(hash)) { bytes = await store.get(hash); break }
            }
            if (!(bytes instanceof Uint8Array) || bytes.length === 0) fail(404, 'Content not available on this node')
            if (bytes.length > 1_048_576) fail(413, 'Explorer content exceeds 1 MiB')
            const message = ctx.path === '/explorer/block' ? new BlockMessage(bytes) : new TransactionMessage(bytes)
            if (await message.hash() !== hash) fail(503, 'Stored content hash mismatch')
            return { ...response, encoded: bytes }
          }
          if (ctx.path === '/explorer/pool') {
            if (!globalThis.transactionPoolStore) fail(503, 'Transaction pool unavailable')
            return { ...response, hashes: (await globalThis.transactionPoolStore.keys(101)).slice(0, 101).map(String) }
          }
          if (ctx.path === '/explorer/overview') {
            const [validators, registeredContracts, nativeCalls, nativeMints, nativeBurns, nativeTransfers,
              totalContracts, totalTransactions, totalSize, poolCount, poolSize, balances] = await Promise.all([
              chain.staticCall(identity.genesisContracts.validators, 'validators', []),
              chain.staticCall(identity.genesisContracts.contractFactory, 'totalContracts', []),
              chain.nativeCalls, chain.nativeMints, chain.nativeBurns, chain.nativeTransfers,
              chain.totalContracts, chain.totalTransactions, chain.totalSize,
              globalThis.transactionPoolStore?.length(), globalThis.transactionPoolStore?.size(), chain.balances
            ])
            let supply = 0n
            let funded = 0
            const top: Array<{ address: string; balance: bigint }> = []
            if (!balances || typeof balances !== 'object') fail(503, 'Balances unavailable')
            for (const [address, raw] of Object.entries(balances)) {
              const balance = BigInt(raw as string)
              if (balance <= 0n) continue
              supply += balance; funded++
              top.push({ address, balance })
              top.sort((a, b) => a.balance === b.balance ? a.address.localeCompare(b.address) : a.balance > b.balance ? -1 : 1)
              if (top.length > 5) top.pop()
            }
            return { ...response, validators, registeredContracts, nativeCalls, nativeMints, nativeBurns,
              nativeTransfers, totalContracts, totalTransactions, totalSize, poolCount, poolSize,
              holders: { total: funded, holders: top.map(holder => ({ ...holder, share: Number(holder.balance * 10000n / (supply || 1n)) / 100 })) } }
          }
          fail(404, 'Unknown read-only explorer resource')
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Explorer read timed out'), { status: 503 })), 10000) })
      ])
      ctx.body = body
    } catch (error) {
      ctx.status = [400, 404, 405, 409, 413, 503].includes(error.status) ? error.status : 503
      ctx.body = { error: ctx.status === 503 ? 'Public explorer data unavailable; retry after node sync' : error.message }
    } finally { clearTimeout(timer) }
  }
}
