import BlockMessage from "./exports/messages/block.js";
import BWRequestMessage from "./exports/messages/bw-request.js";
import { ContractMessage } from "./exports/index.js";
globalThis.peernet = globalThis.peernet || {}
peernet.codecs = {
  'contract-message': {
    codec: parseInt('63636d', 16),
    hashAlg: 'keccak-256'
  },
  'transaction-message': {
    codec: parseInt('746d', 16),
    hashAlg: 'keccak-256'
  },

  'block-message': {
    codec: parseInt('626d', 16),
    hashAlg: 'keccak-256'
  },

  'bw-message': {
    codec: parseInt('62776d', 16),
    hashAlg: 'keccak-256'
  },

  'bw-request-message': {
    codec: parseInt('6277726d', 16),
    hashAlg: 'keccak-256'
  },
  'validator-message': {
    codec: parseInt('766d', 16),
    hashAlg: 'keccak-256'
  }
}

// globalThis.peernet.codecs
const validators = [{
  address: 'address',
  reward: 0
}]

const transactions = []
for (let i = 0; i <= 11_235; i++) {
  transactions.push(
    {
      timestamp: new Date().getTime(),
      from: 'fromAddress',
      to: 'toAddress',
      nonce: 0,
      method: 'getAddress',
      params: [],
      signature: new Uint8Array(32)
    }
  )
}

const block = {
  index: 0,
  previousHash: 'hash',
  timestamp: new Date().getTime(),
  reward: 0,
  fees: 0,
  transactions,
  validators
}
const contractMessage = new ContractMessage({
  creator: '',
  contract: new Uint8Array(),
  constructorParameters: []
})

const bw = new BWRequestMessage()

const message = new BlockMessage(block)
console.time('message encoded')
await message.encode()
console.timeEnd('message encoded')
console.time('normal encoded')
const normalEncoded = new TextEncoder().encode(JSON.stringify(block))
console.timeEnd('normal encoded')

console.log('# is smaller then normal encoded');
console.info(`normal: ${normalEncoded.length}\nmessage: ${message.encoded.length}`);
console.log(normalEncoded.length > message.encoded.length);