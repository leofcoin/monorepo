
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

    this.channelName = options.channelName || Buffer.from(Math.random().toString(36).slice(-12)).toString('hex')
console.log(this.channelName);
this.options = options
this.socketClient.pubsub.subscribe('signal', this._in)
    this.#init()
   }

   async #init() {
     try {

       const iceServers = [{
        urls: 'stun:stun.l.google.com:19302' // Google's public STUN server
       }]
       this.#connection = new wrtc.RTCPeerConnection();
       this.#connection.onicecandidate = ({ candidate }) => {
         console.log({candidate});
        if (candidate) this.sendMessage({candidate});
       };
       console.log(this.initiator);
       // if (this.initiator) this.#connection.onnegotiationneeded = () => {
         // console.log('create offer');
         this.#connection.ondatachannel = (message) => {
           message.channel.onopen = () => message.channel.send('hi');
           message.channel.onclose = () => console.log('close');
           message.channel.onmessage = (message) => console.log(message.data);

         }
        if (this.initiator) {

          this.channel = this.#connection.createDataChannel('messageChannel')
          this.channel.onopen = () => {
            // pubsub.publish('peer:connected', )
            // this.channel.send('hi')
          }
          this.channel.onclose = () => console.log('close');
          this.channel.onmessage = (message) => console.log({message});

         const offer = await this.#connection.createOffer()
         await this.#connection.setLocalDescription(offer)

         this.sendMessage({'sdp': this.#connection.localDescription})
        }
       // }

       console.log(this.#connection);
     } catch (e) {
       console.log(e);
     }
   }

   // async localDescriptionCreated(desc) {
   //   await this.#connection.setLocalDescription(desc)
   //   this.sendMessage({'sdp': this.#connection.localDescription})
   // }
   //
   // async remoteDescriptionCreated(desc) {
   //   await this.#connection.setRemoteDescription(desc)
   //   this.sendMessage({'sdp': this.#connection.remoteDescription})
   // }

   sendMessage(message) {
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
    if (message.candidate) return this.#connection.addIceCandidate(new wrtc.RTCIceCandidate(message.candidate));
    try {
      if (message.sdp) {
        if (message.sdp.type === 'offer') {
          await this.#connection.setRemoteDescription(new wrtc.RTCSessionDescription(message.sdp))
          const answer = await this.#connection.createAnswer();
          await this.#connection.setLocalDescription(answer)
          this.sendMessage({'sdp': this.#connection.localDescription})
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
 }
}
