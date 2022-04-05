// import config from './config/config'
import Peernet from '@leofcoin/peernet'
import lib from './lib'
const { ContractMessage, TransactionMessage, BlockMessage, BWMessage, BWRequestMessage } = lib

export default class Node {
  constructor() {
    return this._init()
  }

  async _init(config = {
    network: 'leofcoin:olivia',
    root: '.artonline',
    networkName: 'leofcoin:olivia',
    networkVersion: 'v0.1.0'
  }) {
    await new Peernet(config)

    await peernet.addRequestHandler('bw-request-message', () => {

      return new BWMessage(peernet.client.bw) || { up: 0, down: 0 }
    })

    await peernet.addProto('contract-message', ContractMessage)
    await peernet.addProto('transaction-message', TransactionMessage)
    await peernet.addProto('block-message', BlockMessage)
    await peernet.addProto('bw-message', BWMessage)
    await peernet.addProto('bw-request-message', BWRequestMessage)

    await peernet.addCodec('contract-message', {
      codec: '636d',
      hashAlg: 'keccak-256'
    })
    await peernet.addCodec('transaction-message', {
      codec: '746d',
      hashAlg: 'keccak-256'
    })

    await peernet.addCodec('block-message', {
      codec: '626d',
      hashAlg: 'keccak-256'
    })

    await peernet.addCodec('bw-message', {
      codec: '62776d',
      hashAlg: 'keccak-256'
    })

    await peernet.addCodec('bw-request-message', {
      codec: '6277726d',
      hashAlg: 'keccak-256'
    })

    await peernet.addStore('contract', 'art', '.ArtOnline', false)
    await peernet.addStore('transactionPool', 'art', '.ArtOnline', false)
    return this
    // this.config = await config()
  }

}
