import { BlockMessage, TransactionMessage } from '@leofcoin/messages'

// Simulated content only: deliberately unsigned and never sent to a real node.
export async function explorerFixture(address, nativeToken = 'fixture-native-token-contract') {
  const blocks = []
  const blockBytes = new Map()
  const transactions = new Map()
  let previousHash = '0x0'
  const now = Date.now()
  for (let index = 0; index < 65; index++) {
    const hashes = []
    for (let position = 0; position < index % 3 + 1; position++) {
      const transaction = new TransactionMessage({ timestamp: now - (65 - index) * 30000,
        from: address, to: nativeToken, method: 'transfer', params: [address, (BigInt(index + 1) * 10n ** 18n + 1n).toString()],
        signature: 'unsigned-ui-fixture', nonce: index * 3 + position })
      const hash = await transaction.hash()
      transactions.set(hash, transaction.encoded)
      hashes.push(hash)
    }
    const message = new BlockMessage({ index: BigInt(index), previousHash, timestamp: now - (65 - index) * 30000,
      reward: 2n * 10n ** 18n, fees: BigInt(hashes.length) * 10n, transactions: hashes,
      validators: [{ address, reward: 2n * 10n ** 18n }], producer: address,
      producerProof: 'unsigned-ui-fixture', protocolVersion: '0.4.0' })
    const hash = await message.hash()
    blockBytes.set(hash, message.encoded)
    blocks.push({ ...message.decoded, hash, loaded: true })
    previousHash = hash
  }
  const pending = new TransactionMessage({ timestamp: now, from: address, to: nativeToken,
    method: 'transfer', params: [address, '1'], signature: 'unsigned-ui-fixture', nonce: 999 })
  const pendingHash = await pending.hash()
  const pool = new Map([[pendingHash, pending.encoded]])
  const store = map => ({ has: async hash => map.has(hash), get: async hash => map.get(hash), keys: async () => [...map.keys()] })
  return { blocks, nativeToken, blockBytes, transactions, transactionStore: store(transactions), transactionPoolStore: store(pool) }
}
