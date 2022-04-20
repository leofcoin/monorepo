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

  get connection() {
    return this.#connection
  }

  get connected() {
    return this.#connected
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

    this.channelName = options.channelName || Buffer.from(Math.random().toString(36).slice(-12)).toString('hex')
    console.log(this.channelName);
    this.options = options
    this.#init()
   }

   set socketClient(value) {
     // this.socketClient?.pubsub.unsubscribe('signal', this._in)
     this._socketClient = value
     this._socketClient.pubsub.subscribe('signal', this._in)
   }

   get socketClient() {
     return this._socketClient
   }

   send(message) {
     this.bw.up += message.length
     this.channel.send(message)
   }

   request(data) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(-12)
      data = new TextEncoder().encode(JSON.stringify({id, data}))
      const _onData = (message) => {
        if (message.id !== id) return

        resolve(message.data)
      }

      pubsub.subscribe('peer:data', _onData)

      // cleanup subscriptions
      setTimeout(() => {
        pubsub.unsubscribe('peer:data', _onData)
      }, 5000);

      this.send(data)
    });
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
       };
       // if (this.initiator) this.#connection.onnegotiationneeded = () => {
         // console.log('create offer');
         this.#connection.ondatachannel = (message) => {
           message.channel.onopen = () => {
             pubsub.publish('peer:connected', this)
           }
           message.channel.onclose = () => console.log('close');
           message.channel.onmessage = (message) => {
             if (message.to) {
               if (message.to === this.id) pubsub.publish('peer:data', message)
             } else pubsub.publish('peer:data', message)
             this.bw.down += message.length
           }
           this.channel = message.channel
         }
        if (this.initiator) {

          this.channel = this.#connection.createDataChannel('messageChannel')
          this.channel.onopen = () => {
            pubsub.publish('peer:connected', this)
            // this.channel.send('hi')
          }
          this.channel.onclose = () => console.log('close');
          this.channel.onmessage = (message) => {
            if (message.to) {
              if (message.to === this.id) pubsub.publish('peer:data', message)
            } else pubsub.publish('peer:data', message)
            this.bw.down += message.length
          }

         const offer = await this.#connection.createOffer()
         await this.#connection.setLocalDescription(offer)

         this._sendMessage({'sdp': this.#connection.localDescription})
        }
       // }

     } catch (e) {
       console.log(e);
     }
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
      this.remoteAddress = message.candidate.address
      this.remotePort = message.candidate.port
      this.remoteProtocol = message.candidate.protocol
      this.remoteIpFamily = this.remoteAddress?.includes('::') ? 'ipv6': 'ipv4'
      return this.#connection.addIceCandidate(new wrtc.RTCIceCandidate(message.candidate));
    }
    try {
      if (message.sdp) {
        if (message.sdp.type === 'offer') {
          await this.#connection.setRemoteDescription(new wrtc.RTCSessionDescription(message.sdp))
          const answer = await this.#connection.createAnswer();
          await this.#connection.setLocalDescription(answer)
          this._sendMessage({'sdp': this.#connection.localDescription})
        }
        if (message.sdp.type === 'answer') {
          await this.#connection.setRemoteDescription(new wrtc.RTCSessionDescription(message.sdp))
        }
     }
    } catch (e) {
      console.log(e);
    }
 }

 close() {
   this.channel?.close()
   this.#connection?.close()

   this.socketClient.pubsub.unsubscribe('signal', this._in)
 }
}
