import '@vandeurenglenn/debug'
import SimplePeer from '@vandeurenglenn/simple-peer'
export default class Peer {
  #connection
  #connected = false
  #messageQue = []
  #chunksQue = {}
  #channel
  id: string
  #peerId: string
  #channelName
  #chunkSize = 16 * 1024 // 16384
  #queRunning = false
  #MAX_BUFFERED_AMOUNT = 16 * 1024 * 1024
  initiator: boolean = false
  state: string
  #makingOffer: boolean = false

  get connection() {
    return this.#connection
  }

  get connected() {
    return this.#connected
  }

  get readyState() {
    return this.#channel?.readyState
  }

  get channelName() {
    return this.#channelName
  }

  /**
   * @params {Object} options
   * @params {string} options.channelName - this peerid : otherpeer id
  */
  constructor(options = {}) {
    this._in = this._in.bind(this);
    this.offerOptions = options.offerOptions
    this.initiator = options.initiator
    this.streams = options.streams
    this.socketClient = options.socketClient
    this.id = options.id
    this.to = options.to
    this.bw = {
      up: 0,
      down: 0
    }

    this.#channelName = options.channelName 

    this.#peerId = options.peerId
    this.options = options
    return this.#init()
  }

  get peerId() {
    return this.#peerId
  }

  set socketClient(value) {
    // this.socketClient?.pubsub.unsubscribe('signal', this._in)
    this._socketClient = value
    this._socketClient.pubsub.subscribe('signal', this._in)
  }

  get socketClient() {
    return this._socketClient
  }

  splitMessage(message) {
    const chunks = []
    message = pako.deflate(message)
    const size = message.byteLength || message.length
    let offset = 0
    return new Promise((resolve, reject) => {
      const splitMessage = () => {
        const chunk = message.slice(offset, offset + this.#chunkSize > size ? size : offset + this.#chunkSize)
        offset += this.#chunkSize
        chunks.push(chunk)
        if (offset < size) return splitMessage()
        else resolve({chunks, size})
      }

      splitMessage()
    })
  }

  async #runQue() {
    this.#queRunning = true
    if (this.#messageQue.length > 0 && this.#channel?.bufferedAmount + this.#messageQue[0]?.length < this.#MAX_BUFFERED_AMOUNT) {
      const message = this.#messageQue.shift()
      await this.#connection.send(message);
      if (this.#messageQue.length > 0) return this.#runQue()
      // switch (this.#channel?.readyState) {
      //   case 'open':
      //   await this.#channel.send(message);
      //   if (this.#messageQue.length > 0) return this.#runQue()
      //   else this.#queRunning = false
      //   break;
      //   case 'closed':
      //   case 'closing':
      //   this.#messageQue = []
      //   this.#queRunning = false
      //   debug('channel already closed, this usually means a bad implementation, try checking the readyState or check if the peer is connected before sending');
      //   break;
      //   case undefined:
      //   this.#messageQue = []
      //   this.#queRunning = false
      //   debug(`trying to send before a channel is created`);
      //   break;
      // }


    } else {
      return setTimeout(() => this.#runQue(), 50)
    }
  }

  #trySend({ size, id, chunks }) {
    let offset = 0

    for (const chunk of chunks) {
      const start = offset
      const end = offset + chunk.length

      const message = new TextEncoder().encode(JSON.stringify({ size, id, chunk, start, end }));
      this.#messageQue.push(message)
    }

    if (!this.queRunning) return this.#runQue()
  }

  async send(message, id) {
    const { chunks, size } = await this.splitMessage(message)
    return this.#trySend({ size, id, chunks })
  }

  request(data) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(-12)

      const _onData = message => {
        if (message.id === id) {
          resolve(message.data)
          pubsub.unsubscribe(`peer:data`, _onData)
        }
      }

      pubsub.subscribe(`peer:data`, _onData)

      // cleanup subscriptions
      // setTimeout(() => {
      //   pubsub.unsubscribe(`peer:data-request-${id}`, _onData)
      // }, 5000);

      this.send(data, id)
    })
  }

  async #init() {
    try {

      if (!globalThis.pako) {
        const importee = await import('pako')
        globalThis.pako = importee.default
      }

      const iceServers = [{
        urls: 'stun:stun.l.google.com:19302' // Google's public STUN server
      }, {
        urls: "stun:openrelay.metered.ca:80",
      }, {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
      }, {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
      }]

      this.#connection = new SimplePeer({
        channelName: this.channelName,
        initiator: this.initiator,
        peerId: this.peerId,
        wrtc: globalThis.wrtc,
        config: {
          iceServers
        }
      })

      this.#connection.on('signal', signal => {
        this._sendMessage({signal})
      })

      this.#connection.on('connect', () => {

        this.#connected = true
        pubsub.publish('peer:connected', this)
      })

      this.#connection.on('close', () => {
        this.close()
      })

      this.#connection.on('data', data => {
        this._handleMessage(data)
      })

      this.#connection.on('error', (e) => {
        pubsub.publish('connection closed', this)
        console.log(e);
        this.close()
      })
    } catch (e) {
      console.log(e);
    }

    return this
  }

  _handleMessage(message) {
    console.log({message});
    
    message = JSON.parse(new TextDecoder().decode(message.data))
    // allow sharding (multiple peers share data)
    pubsub.publish('peernet:shard', message)
    const { id } = message

    if (!this.#chunksQue[id]) this.#chunksQue[id] = []

    if (message.size > this.#chunksQue[id].length || message.size === this.#chunksQue[id].length) {
      for (const value of Object.values(message.chunk)) {
        this.#chunksQue[id].push(value)
      }
    }

    if (message.size === this.#chunksQue[id].length) {
      let data = new Uint8Array(Object.values(this.#chunksQue[id]))
      delete this.#chunksQue[id]
      data = pako.inflate(data)
      pubsub.publish('peer:data', { id, data, from: this.peerId })
    }
    this.bw.down += message.byteLength || message.length
  }

  _sendMessage(message) {
    this.socketClient.send({url: 'signal', params: {
      to: this.to,
      from: this.id,
      channelName: this.channelName,
      ...message
    }})
  }

  async _in(message, data) {
    if (message.signal) return this.#connection.signal(message.signal)
  }

  close() {
  //  debug(`closing ${this.peerId}`)
    this.#connected = false
    // this.#channel?.close()
    // this.#connection?.exit()

    this.socketClient.pubsub.unsubscribe('signal', this._in)
  }
}
