_callContract  = () => {
  
}
const messageHandler = {
  'add-block': async message => {
    try {
      await this._validatBlock(message.data)

      for (const transaction of message.data.transactions) {
        const type = transactionType(transaction)
        // check if transaction is a contract call or just a normal tx
        if (type === 'call') this._callContract(transaction)
        else this._addTransaction(transaction)
      }
    } catch (e) {
      console.warn(`Ignored invalid block: ${message.data.index}`);
    }
  },
  'get-block': async (message, peer) => {
    let block = await peernet.block(message.data)
    // return block to message sender
    block = await encode(block, 'block')
    peer.send(block)
  }
}

export default class Network {
  constructor() {
    this.onmessage('message', message => {
      message = await decode(message)
      messageHandler[message.type](message)
    })
  }

  async peers() {
    return this._peers
  }

  async connect(peer) {

  }

  async dialPeer(peer, video = false) {
    this._call(video)
  }

  async messagePeer(peerId, message) {
    this._peers[peerId].send(message)
  }

  async onmessage() {
    // normal protocol
  }

  async onPeerMessage() {
    // peer communication
  }

  get bandwith() {
    return {
      out: this._out,
      in: this._in
    }
  }

  reputation(peer) {
    let reputation = 0
    const blacklisted = await this._blacklisted(peer)
    if (!blacklisted) reputation = await this._reputation(peer)
    return reputation
  }

}
