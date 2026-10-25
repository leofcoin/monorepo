import { ContractMessage, TransactionMessage } from '@leofcoin/messages'
import { verifyChainIdentity } from '@leofcoin/lib/chain-identity'
import { ManagerReceipts, type Receipt } from './manager-receipts.js'

const MAX_BODY = 1_048_576
const errorMessage = (error) => error?.error?.message || error?.message || String(error?.error || error)

class RequestError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function readBody(request) {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY) throw new RequestError(413, 'Management request exceeds 1 MiB')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new RequestError(400, 'Management request must contain JSON') }
}

/** No remote wallet access: only public queries and client-signed transactions. */
export function managerMiddleware(chain) {
  const store = globalThis.chainStore
  const contractStore = globalThis.contractStore
  const journal = new ManagerReceipts(() => store, chain)
  const live = new Set<string>()
  const peerCount = () => Object.values(globalThis.peernet?.connections || {})
    .filter((peer: { connected?: boolean }) => peer.connected).length
  return async (ctx, next) => {
    if (ctx.path !== '/manager/rpc') return next()
    ctx.set('Cache-Control', 'no-store')
    if (ctx.method !== 'POST') {
      ctx.status = 405
      ctx.body = { error: 'Use POST with application/json' }
      return
    }
    try {
      if (!ctx.is('application/json')) throw new RequestError(415, 'Content-Type must be application/json')
      const body = await readBody(ctx.req)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError(400, 'Invalid request')
      const identity = await verifyChainIdentity(await chain.getChainIdentity())
      if (body.chainId !== identity.chainId) throw new RequestError(409, 'Endpoint chain identity changed; reconnect and review')
      const { action } = body
      if (action === 'status') {
        const account = body.account
        if (account !== undefined && (typeof account !== 'string' || account.length > 128))
          throw new RequestError(400, 'Invalid account')
        ctx.body = {
          apiVersion: 1, chainId: identity.chainId, network: identity.network,
          nativeToken: identity.genesisContracts.nativeToken, contractFactory: identity.genesisContracts.contractFactory,
          height: String((await journal.tip())?.index ?? 0), peers: peerCount(), synced: chain.state?.sync === 'synced',
          balance: account ? String(await chain.balanceOf(account) ?? 0) : '0',
          nonce: account ? await chain.getNonce(account) : 0
        }
      } else if (action === 'read') {
        if (typeof body.contract !== 'string' || !/^[A-Z2-7]{32,128}$/.test(body.contract) ||
            typeof body.method !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(body.method) ||
            !Array.isArray(body.params) || body.params.length > 100)
          throw new RequestError(400, 'Invalid contract, method or parameter array')
        ctx.body = { value: await chain.staticCall(body.contract, body.method, body.params) ?? null }
      } else if (action === 'receipt') {
        if (typeof body.hash !== 'string' || !/^[A-Z2-7]{32,128}$/.test(body.hash)) throw new RequestError(400, 'Invalid transaction hash')
        ctx.body = await journal.serialized(async () => {
          const receipts = await journal.load(identity.chainId)
          const receipt = receipts.get(body.hash)
          if (!receipt) return { hash: body.hash, status: 'unknown' }
          if (live.has(`${identity.chainId}:${body.hash}`)) return receipt
          const reconciled = await journal.reconcile(receipt)
          receipts.set(body.hash, reconciled)
          await journal.save(identity.chainId, receipts)
          return reconciled
        })
      } else if (action === 'submit') {
        if (!chain.state || chain.state.sync !== 'synced' || peerCount() === 0)
          throw new RequestError(503, 'Node must be synced and connected before submission')
        const transaction = body.transaction
        if (!transaction || typeof transaction !== 'object' || !transaction.signature)
          throw new RequestError(400, 'A client-signed transaction is required')
        const message = new TransactionMessage(transaction)
        if (message.encoded.length > 32768) throw new RequestError(413, 'Transaction exceeds 32 KiB')
        const hash = await message.hash()
        // Validate before persisting uploaded code, including its binding to this signed registration.
        await chain.validateTransactionSignature(message)
        let contract: ContractMessage | undefined
        if (body.contract !== undefined) {
          if (typeof body.contract !== 'string') throw new RequestError(400, 'Contract must be an encoded message')
          contract = new ContractMessage(body.contract)
          if (contract.encoded.length > 262144 || contract.decoded.creator !== transaction.from ||
              transaction.to !== identity.genesisContracts.contractFactory ||
              transaction.method !== 'registerContract' || transaction.params?.length !== 1 ||
              transaction.params[0] !== await contract.hash())
            throw new RequestError(400, 'Contract does not match the signed factory registration')
        }
        ctx.body = await journal.serialized(async () => {
          const receipts = await journal.load(identity.chainId)
          const known = receipts.get(hash)
          if (known) return known
          const height = Number((await journal.tip())?.index ?? 0)
          if (!Number.isSafeInteger(height) || height < 0) throw new Error('Invalid submission height')
          const receipt: Receipt = { hash, status: 'submitting', createdAt: Date.now(), startHeight: height }
          journal.reserve(receipts, receipt)
          await journal.save(identity.chainId, receipts)
          try {
            if (contract) await contractStore.put(await contract.hash(), contract.encoded)
            const pending = await chain.sendTransaction(transaction)
            if (pending?.hash !== hash || !pending.wait || typeof pending.wait.then !== 'function')
              throw new Error('Node did not return a canonical completion handle')
            receipt.status = 'pending'
            live.add(`${identity.chainId}:${hash}`)
            Promise.resolve(pending.wait).then(
              () => journal.complete(identity.chainId, hash, 'confirmed'),
              error => journal.complete(identity.chainId, hash, 'failed', errorMessage(error))
            ).catch(error => console.error('Could not persist canonical management completion:', hash, error))
              .finally(() => live.delete(`${identity.chainId}:${hash}`))
          } catch (error) {
            // The node may already have admitted the transaction. Never silently auto-resend.
            receipt.status = 'unknown'
            receipt.error = errorMessage(error)
            console.error('Management submission could not be verified:', hash, error)
          }
          await journal.save(identity.chainId, receipts)
          return receipt
        })
      } else throw new RequestError(400, 'Unsupported management action')
    } catch (error) {
      ctx.status = error instanceof RequestError ? error.status : 400
      ctx.body = { error: errorMessage(error) }
      if (!(error instanceof RequestError)) console.error('Management request failed:', error)
    }
  }
}
