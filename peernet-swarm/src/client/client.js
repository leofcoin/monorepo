import SocketClient from './../../node_modules/socket-request-client/src/index'
import browserRTC from 'get-browser-rtc'
import Peer from './peer'

export default class Client {
  #peerConnection

  constructor(id, identifiers = ['peernet-v0.1.0']) {
    this.id = id || Math.random().toString(36).slice(-12);
    if (!Array.isArray(identifiers)) identifiers = [identifiers]
    this.peerJoined = this.peerJoined.bind(this)
    this.peerLeft = this.peerLeft.bind(this)

    this._init(identifiers)
  }

  async _init(identifiers) {
    const wrtc = await browserRTC()
    globalThis.wrtc = wrtc ? wrtc : await import('wrtc')
    // RTCPeerConnection
    this.#peerConnection = new Peer({initiator: true})
    this.socketClient = await SocketClient('ws://localhost:4400', identifiers[0])
    const peers = await this.socketClient.peernet.join({id: this.id})
    console.log(peers);

    this.socketClient.subscribe('peer:joined', this.peerJoined)
    this.socketClient.subscribe('peer:left', this.peerLeft)
  }

  peerLeft(id) {
    console.log(`peer ${id} left`);
  }

  peerJoined(id) {
    console.log(`peer ${id} joined`);
  }
}
