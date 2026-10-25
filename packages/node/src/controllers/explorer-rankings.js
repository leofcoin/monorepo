const compareAddresses = (a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0)

export function formatRankingBalance(units) {
  const value = BigInt(units)
  const whole = value / 10n ** 18n
  const fraction = (value % (10n ** 18n)).toString().padStart(18, '0')
  const decimals = fraction.slice(0, 4).replace(/0+$/, '')
  return `${whole.toLocaleString('en-US')}${decimals ? `.${decimals}` : ''}${/[1-9]/.test(fraction.slice(4)) ? '…' : ''}`
}

export function rankHolders(balances, limit = 5) {
  if (!balances || typeof balances !== 'object' || Array.isArray(balances))
    throw new Error('Holder balances are unavailable.')
  let supply = 0n
  const holders = Object.entries(balances).map(([address, value]) => {
    if (!address || !/^\d+$/.test(String(value)) || (typeof value === 'number' && !Number.isSafeInteger(value)))
      throw new Error('Invalid holder balance.')
    const balance = BigInt(value)
    supply += balance
    return { address, balance }
  }).filter((holder) => holder.balance > 0n)
  holders.sort((a, b) => a.balance === b.balance ? compareAddresses(a, b) : a.balance > b.balance ? -1 : 1)
  return {
    total: holders.length,
    holders: holders.slice(0, limit).map((holder) => ({
      ...holder,
      share: supply ? Number(holder.balance * 10000n / supply) / 100 : 0
    }))
  }
}

export function rankActivity(blocks, limit = 5) {
  const senders = new Map()
  const contracts = new Map()
  const indexes = new Set()
  for (const block of [...blocks].sort((a, b) => Number(b.index) - Number(a.index))) {
    const index = Number(block.index)
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid ranking block index.')
    if (indexes.has(index)) continue
    if (indexes.size === 128) break
    indexes.add(index)
    if (!Array.isArray(block.transactions)) throw new Error('Invalid ranking block transactions.')
    for (const transaction of block.transactions) {
      if (typeof transaction.from === 'string' && transaction.from) {
        senders.set(transaction.from, (senders.get(transaction.from) || 0) + 1)
      }
      if (typeof transaction.to !== 'string' || !transaction.to || typeof transaction.method !== 'string' || !transaction.method)
        continue
      const contract = contracts.get(transaction.to) || { calls: 0, senders: new Set() }
      contract.calls++
      if (typeof transaction.from === 'string' && transaction.from) contract.senders.add(transaction.from)
      contracts.set(transaction.to, contract)
    }
  }
  const byCount = (a, b) => b.count - a.count || compareAddresses(a, b)
  return {
    blocks: indexes.size,
    start: indexes.size ? Math.min(...indexes) : null,
    end: indexes.size ? Math.max(...indexes) : null,
    addresses: [...senders].map(([address, count]) => ({ address, count })).sort(byCount).slice(0, limit),
    contracts: [...contracts].map(([address, value]) => ({
      address, count: value.calls, callers: value.senders.size
    })).sort(byCount).slice(0, limit)
  }
}
