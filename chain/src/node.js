// import config from './config/config'
import Peernet from '@leofcoin/peernet'
import lib from './lib'
const { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } = lib

export default class Node {
  constructor() {
    return this._init()
  }

  async _init(config = {
    network: 'leofcoin',
    root: '.artonline',
    networkName: 'leofcoin:olivia',
    networkVersion: 'v0.1.0'
  }) {
    globalThis.Peernet?.default ? await new globalThis.Peernet.default(config) : await new Peernet(config)

    await peernet.addProto('contract-message', ContractMessage)
    await peernet.addProto('transaction-message', TransactionMessage)
    await peernet.addProto('block-message', BlockMessage)
    await peernet.addProto('bw-message', BWMessage)
    await peernet.addProto('bw-request-message', BWRequestMessage)

    await peernet.addCodec('contract-message', {
      codec: parseInt('636d', 16),
      hashAlg: 'keccak-256'
    })
    await peernet.addCodec('transaction-message', {
      codec: parseInt('746d', 16),
      hashAlg: 'keccak-256'
    })

    await peernet.addCodec('block-message', {
      codec: parseInt('626d', 16),
      hashAlg: 'keccak-256'
    })

    await peernet.addCodec('bw-message', {
      codec: parseInt('62776d', 16),
      hashAlg: 'keccak-256'
    })

    await peernet.addCodec('bw-request-message', {
      codec: parseInt('6277726d', 16),
      hashAlg: 'keccak-256'
    })

    await peernet.addStore('contract', 'art', '.ArtOnline', false)
    await peernet.addStore('transactionPool', 'art', '.ArtOnline', false)
    return this
    // this.config = await config()
  }

}
