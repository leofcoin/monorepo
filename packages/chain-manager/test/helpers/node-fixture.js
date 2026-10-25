import http from '../../../endpoints/exports/http.js'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { createTransactionHash } from '@leofcoin/lib'
import { ContractMessage, TransactionMessage } from '@leofcoin/messages'
import MultiWallet from '@leofcoin/multi-wallet'
import base58 from '@vandeurenglenn/base58'

export async function createNodeFixture({ guidedFaucet = false } = {}) {
  const identity = await createChainIdentity('leofcoin:peach', {
    nativeToken: 'A'.repeat(52), contractFactory: 'B'.repeat(52),
    validators: 'C'.repeat(52), nameService: 'D'.repeat(52)
  })
  const sent = []
  const contracts = new Map()
  const previous = { peernet: globalThis.peernet, contractStore: globalThis.contractStore, chainStore: globalThis.chainStore }
  const durable = new Map()
  const blocks = new Map()
  blocks.set(42, { index: 42, hash: 'initial', transactions: [] })
  globalThis.chainStore = { has: async key => durable.has(key), get: async key => durable.get(key), put: async (key, value) => durable.set(key, value) }
  globalThis.peernet = { connections: { fixture: { connected: true } } }
  globalThis.contractStore = { put: async (hash, bytes) => contracts.set(hash, bytes) }
  let nonce = 0
  let allowance = guidedFaucet ? 0n : 1000000000000000000000n
  const faucetStates = new Map()
  const faucetBalances = new Map()
  const chain = {
    getChainIdentity: async () => identity, state: { sync: 'synced' }, lastBlock: { index: 42n, hash: 'initial' },
    getBlocks: async (from, to) => [...blocks.values()].filter(block => block.index >= from && block.index < to),
    balanceOf: async () => 10000000000000000000000n,
    getNonce: async () => nonce,
    staticCall: async (contract, method, params) => ({
      tokenAmountToReceive: 1000000000000000000000n,
      tokenToReceive: identity.genesisContracts.nativeToken,
      allowance, hasRole: true, decimals: 18,
      state: faucetStates.get(contract), balanceOf: faucetBalances.get(params?.[0]) ?? 0n
    })[method] ?? null,
    validateTransactionSignature: async transaction => {
      const wallet = new MultiWallet('leofcoin:peach')
      await wallet.fromAddress(transaction.decoded.from, null, 'leofcoin:peach')
      if (!await wallet.verify(base58.decode(transaction.decoded.signature), await createTransactionHash(transaction)))
        throw new Error('Fixture rejected invalid signature')
    },
    sendTransaction: async transaction => {
      sent.push(transaction)
      const hash = await new TransactionMessage(transaction).hash()
      return {
        hash,
        wait: new Promise(resolve => setTimeout(() => {
          if (transaction.method === 'approve') allowance = BigInt(transaction.params[1])
          if (transaction.method === 'registerContract' && contracts.has(transaction.params[0])) {
            const message = new ContractMessage(contracts.get(transaction.params[0])).decoded
            const [token, amount, cooldown, budget] = message.constructorParameters
            faucetStates.set(transaction.params[0], { owner: transaction.from, token, amount, cooldown, budget, spent: '0' })
            allowance = 0n
          }
          if (transaction.method === 'transfer') faucetBalances.set(transaction.params[0],
            (faucetBalances.get(transaction.params[0]) ?? 0n) + BigInt(transaction.params[1]))
          nonce = transaction.nonce
          const block = { index: Number(chain.lastBlock.index) + 1, hash: `canonical-${nonce}`, transactions: [hash] }
          chain.lastBlock = block
          blocks.set(block.index, block)
          resolve(hash)
        }, 50))
      }
    }
  }
  const server = http(chain, 0, 'peach')
  await new Promise(resolve => server.once('listening', resolve))
  return {
    endpoint: `http://127.0.0.1:${server.address().port}`, identity, sent, contracts, chain, faucetStates, faucetBalances,
    close() {
      server.closeAllConnections()
      server.close()
      globalThis.peernet = previous.peernet
      globalThis.contractStore = previous.contractStore
      globalThis.chainStore = previous.chainStore
    }
  }
}
