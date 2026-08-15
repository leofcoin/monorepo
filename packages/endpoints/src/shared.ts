import { formatUnits } from '@leofcoin/utils'

export const networkStats = async (chain, networkVersion) => {
  let accountsHolding = 0
  let accountsHoldingAmount = 0n
  const topHolders: { holder: string; amount: string }[] = []
  const balances = Object.entries((await chain.balances) as Record<string, bigint | number | string>)
    .map(([holder, amount]) => {
      return { holder, amount: BigInt(amount) }
    })
    .sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1))

  for (let { holder, amount } of balances) {
    if (amount > 0n) {
      accountsHoldingAmount += amount
      accountsHolding += 1
      topHolders.length < 100 && topHolders.push({ holder, amount: formatUnits(amount) })
    }
  }

  return {
    version: networkVersion,
    peers: globalThis.peernet.peers.map(([id, peer]) => id),
    accounts: await globalThis.accountsStore.length(),
    accountsHolding,
    accountsHoldingAmount: formatUnits(accountsHoldingAmount).toString(),
    topHolders
  }
}

const bootstrap = async () => {
  return globalThis.blockStore.values()
}

export default {
  networkStats,
  bootstrap
}
