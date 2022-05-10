import '@vandeurenglenn/debug'

const messageQue = {}

export default class Peer {
  #connection
  #ready = false
  #connecting = false
  #connected = false
  #channelReady = false
  #destroying = false
  #destroyed = false
  #isNegotiating = false
  #firstNegotiation = true
  #iceComplete = false
  #remoteTracks = []
  #remoteStreams = []
  #pendingCandidates = []
  #senderMap = new Map()
  #iceCompleteTimer
  #channel
  #peerId
  #chunkSize = 16384

  get connection() {
    return this.#connection
  }

  get connected() {
    return this.#connected
  }

  get readyState() {
    return this.channel?.readyState
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

    this.channelName = options.channelName

    this.#peerId = options.peerId
    this.options = options
    this.#init()
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

   async send(message, id) {
     const { chunks, size } = await this.splitMessage(message)
     let offset = 0
     for (const chunk of chunks) {
        const start = offset
        const end = offset + chunk.length
        const message = new TextEncoder().encode(JSON.stringify({ size, id, chunk, start, end }));
        switch (this.channel?.readyState) {
          case 'open':
           this.bw.up += message.length || message.byteLength;
           this.channel.send(message);
          break;
          case 'closed':
          case 'closing':
           debug('channel already closed, this usually means a bad implementation, try checking the readyState or check if the peer is connected before sending');
          break;
          case undefined:
          debug(`trying to send before a channel is created`);
          break;
        }
      }
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
       const iceServers = [{
        urls: 'stun:stun.l.google.com:19302' // Google's public STUN server
       }]

       this.#connection = new wrtc.RTCPeerConnection();

       this.#connection.onicecandidate = ({ candidate }) => {
         if (candidate) {
           this.address = candidate.address
           this.port = candidate.port
           this.protocol = candidate.protocol
           this.ipFamily = this.address.includes('::') ? 'ipv6': 'ipv4'
           this._sendMessage({candidate})
         }
       }
       // if (this.initiator) this.#connection.onnegotiationneeded = () => {
         // console.log('create offer');
       this.#connection.ondatachannel = (message) => {
         message.channel.onopen = () => {
           this.#connected = true
           pubsub.publish('peer:connected', this)
         }
         message.channel.onclose = () => this.close.bind(this)

         message.channel.onmessage = (message) => {
           this._handleMessage(this.id, message)
         }
         this.channel = message.channel
       }
      if (this.initiator) {

        this.channel = this.#connection.createDataChannel('messageChannel')
        this.channel.onopen = () => {
          this.#connected = true
          pubsub.publish('peer:connected', this)
          // this.channel.send('hi')
        }
        this.channel.onclose = () => this.close.bind(this)

        this.channel.onmessage = (message) => {
          this._handleMessage(this.peerId, message)
        }

       const offer = await this.#connection.createOffer()
       await this.#connection.setLocalDescription(offer)

       this._sendMessage({'sdp': this.#connection.localDescription})
     }
     } catch (e) {
       console.log(e);
     }
   }

   _handleMessage(peerId, message) {
     debug(`incoming message from ${peerId}`)

     message = JSON.parse(new TextDecoder().decode(message.data))
     // allow sharding (multiple peers share data)
     pubsub.publish('peernet:shard', message)
     if (!messageQue[message.id]) messageQue[message.id] = []

     if (message.size > messageQue[message.id].length || message.size === messageQue[message.id].length) {
       for (const value of Object.values(message.chunk)) {
         messageQue[message.id].push(value)
       }
     }

     if (message.size === messageQue[message.id].length) {
       pubsub.publish('peer:data', {id: message.id, data: new Uint8Array(Object.values(messageQue[message.id]))})
       delete messageQue[message.id]
     }
     this.bw.down += message.byteLength || message.length
   }

   _sendMessage(message) {
     this.socketClient.send({url: 'signal', params: {
       to: this.to,
       from: this.id,
       channelName: this.options.channelName,
       ...message
     }})
   }

   async _in(message, data) {
    // message = JSON.parse(message);
    if (message.to !== this.id) return
    // if (data.videocall) return this._startStream(true, false); // start video and audio stream
    // if (data.call) return this._startStream(true, true); // start audio stream
    if (message.candidate) {
      debug(`incoming candidate ${this.channelName}`)
      debug(message.candidate.candidate)
      this.remoteAddress = message.candidate.address
      this.remotePort = message.candidate.port
      this.remoteProtocol = message.candidate.protocol
      this.remoteIpFamily = this.remoteAddress?.includes('::') ? 'ipv6': 'ipv4'
      return this.#connection.addIceCandidate(new wrtc.RTCIceCandidate(message.candidate));
    }
    try {
      if (message.sdp) {
        if (message.sdp.type === 'offer') {
          debug(`incoming offer ${this.channelName}`)
          await this.#connection.setRemoteDescription(new wrtc.RTCSessionDescription(message.sdp))
          const answer = await this.#connection.createAnswer();
          await this.#connection.setLocalDescription(answer)
          this._sendMessage({'sdp': this.#connection.localDescription})
        }
        if (message.sdp.type === 'answer') {
          debug(`incoming answer ${this.channelName}`)
          await this.#connection.setRemoteDescription(new wrtc.RTCSessionDescription(message.sdp))
        }
     }
    } catch (e) {
      console.log(e);
    }
 }

 close() {
   debug(`closing ${this.peerId}`)
   this.#connected = false
   this.channel?.close()
   this.#connection?.close()

   this.socketClient.pubsub.unsubscribe('signal', this._in)
 }
}
