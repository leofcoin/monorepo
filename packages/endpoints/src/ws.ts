import Server from './binary-socket.js'
import { formatUnits } from '@leofcoin/utils'
import shared from './shared.js'
import { guardRpcHandler } from './rpc-handler.js'

export default (chain, port, networkVersion, remote = false) => {
  const routes = {
      network: async ({ send }) => {
        send({ version: networkVersion })
      },
      networkStats: async ({ send }) => {
        send(await shared.networkStats(chain, networkVersion))
      },
      balances: async ({ send }) => send(await chain.balances),
      balanceOf: async ({ address, format = false }, { send }) => {
        const balance = (await chain.balances)[address]
        if (balance) send(format ? formatUnits(balance).toString() : balance.toString())
        else send('0n')
      },
      getNonce: async ({ address }, { send }) => send(await chain.getNonce(address)),
      selectedAccount: ({ send }) => {
        if (remote) send(globalThis.peernet.selectedAccount)
        else send(405)
      },
      selectAccount: async ({ address }, { send }) => {
        if (remote)
          try {
            await globalThis.walletStore.put('selected-account', address)
            send(200)
          } catch (error) {
            send(404)
          }
        else send(405)
      },
      accounts: async ({ send }) => {
        if (remote) send(JSON.parse(new TextDecoder().decode(await globalThis.walletStore.get('accounts'))))
        else send(405)
      },
      hasTransactionToHandle: async ({ send }) => send(await chain.hasTransactionToHandle()),
      getBlock: async ({ index }, { send }) => send(await chain.getBlock(index)),
      blocks: async ({ amount }, { send }) => {
        send(await globalThis.blockStore.values(amount))
      },
      sendTransaction: async (transaction, { send }) => {
        try {
          const tx = await chain.sendTransaction(transaction)
          await (typeof tx.wait === 'function' ? tx.wait() : tx.wait)
          delete tx.wait
          send(tx)
        } catch (error) {
          send({ error: error instanceof Error ? error.message : 'Transaction failed' }, 422)
        }
      },
      peerId: ({ send }) => send(globalThis.peernet.peerId),
      peers: ({ send }) => send(globalThis.peernet.peers.map(([id, peer]) => id)),
      validators: ({ send }) => send(chain.validators),
      lookup: async ({ name }, { send }) => send(await chain.lookup(name)),
      staticCall: async ({ contract, method, params }, { send }) =>
        send(await chain.staticCall(contract, method, params ?? [])),
      contracts: async ({ send }) => send(await chain.contracts),
      totalContracts: async ({ send }) => send(await chain.totalContracts),
      nativeToken: async ({ send }) => send(await chain.nativeToken),
      nativeCalls: async ({ send }) => send(await chain.nativeCalls),
      nativeMints: async ({ send }) => send(await chain.nativeMints),
      nativeBurns: async ({ send }) => send(await chain.nativeBurns),
      nativeTransfers: async ({ send }) => send(await chain.nativeTransfers),
      totalBurnAmount: async ({ send }) => send(await chain.totalBurnAmount),
      totalMintAmount: async ({ send }) => send(await chain.totalMintAmount),
      totalTransferAmount: async ({ send }) => send(await chain.totalTransferAmount),
      totalTransactions: async ({ send }) => send(await chain.totalTransactions),
      totalBlocks: async ({ send }) => send(await chain.totalBlocks),
      totalSize: async ({ send }) =>
        send(
          (await globalThis.transactionPoolStore.size()) +
            (await globalThis.blockStore.size()) +
            (await globalThis.accountsStore.size())
        ),
      lastBlock: async ({ send }) => send(await chain.lastBlock),
      lastBlockHeight: async ({ send }) => send(await chain.lastBlockHeight),
      participating: async ({ send }) => send(await chain.participating),
      poolTransactions: async ({ send }) => send(await globalThis.transactionPoolStore.get()),
      transactionsInPool: async ({ send }) => send(await globalThis.transactionPoolStore.length()),
      transactionPoolSize: async ({ send }) => send(await globalThis.transactionPoolStore.size()),
      participate: async ({ address }, { send }) => {
        if (remote) send(await chain.participate(address))
        else send(405)
      },
      deployContract: async ({ transaction, contract }, { send }) => {
        try {
          const tx = await chain.deployContract(contract, transaction)
          await (typeof tx.wait === 'function' ? tx.wait() : tx.wait)
          delete tx.wait
          send(tx)
        } catch (error) {
          send({ error: error instanceof Error ? error.message : 'Deployment failed' }, 422)
        }
      },
      createContractAddress: async ({ owner, code, params }, { send }) => {
        try {
          const address = await chain.createContractAddress(owner, code, params)
          send(address)
        } catch (error) {
          send({ error: error instanceof Error ? error.message : 'Contract address failed' }, 422)
        }
      },

      blockHashMap: async ({ send }) => send(await chain.blockHashMap),

      bootstrap: async ({ send }) => {
        send(await shared.bootstrap())
      }
    }
  return Server({ port, protocol: networkVersion }, Object.fromEntries(
    Object.entries(routes).map(([name, handler]) => [name, guardRpcHandler(handler)])
  ))
}
