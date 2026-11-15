import { BlockMessage, TransactionMessage } from './exports/index.js'

declare const block: BlockMessage
declare const transaction: TransactionMessage

const index: bigint = block.decoded.index
const timestamp: number = block.decoded.timestamp
const references: string[] = block.decoded.transactions
const nonce: number | undefined = transaction.decoded.nonce
const method: string = transaction.decoded.method
const parameters: unknown[] = transaction.decoded.params

// @ts-expect-error Block references are hashes, not decoded transactions.
const invalid: TransactionMessage['decoded'][] = block.decoded.transactions

void [index, timestamp, references, nonce, method, parameters, invalid]
