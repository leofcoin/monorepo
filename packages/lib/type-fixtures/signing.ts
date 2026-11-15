import { signTransaction } from '../exports/index.js'

declare const signature: Uint8Array
const transaction = { from: 'sender', to: 'recipient', method: 'transfer', params: [], timestamp: 1, nonce: 1 }
const signed = signTransaction(transaction, { async sign() { return signature } })
type Nonce = Awaited<typeof signed>['nonce']
const nonce: Nonce = 1
void nonce
