declare type messageInput = Uint8Array | String | Object | ArrayBuffer

export { default as BlockMessage } from './messages/block.js'
export { default as BWMessage } from './messages/bw.js'
export { default as BWRequestMessage } from './messages/bw-request.js'
export { default as ContractMessage } from './messages/contract.js'
export { default as LastBlockMessage } from './messages/last-block.js'
export { default as LastBlockRequestMessage } from './messages/last-block-request.js'
export { default as TransactionMessage } from './messages/transaction.js'
export { default as RawTransactionMessage } from './messages/raw-transaction.js'
export { default as ValidatorMessage } from './messages/validator.js'