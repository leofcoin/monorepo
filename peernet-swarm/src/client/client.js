import SocketClient from './../../node_modules/socket-request-client/src/index'
// import pubsub from './../pubsub'
import browserRTC from 'get-browser-rtc'
import Peer from './peer'

export default class Client {
  #peerConnection
  #connections = {}
  #localConnections = {}

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
    this.socketClient = await SocketClient('ws://localhost:4400', identifiers[0])
    const peers = await this.socketClient.peernet.join({id: this.id})
    console.log(peers);
    for (const id of peers) {
      if (id !== this.id && !this.#connections[id]) this.#connections[id] = new Peer({channelName: `${this.id}:${id}`, socketClient: this.socketClient, id: this.id, to: id})
    }

    this.socketClient.subscribe('peer:joined', this.peerJoined)
    this.socketClient.subscribe('peer:left', this.peerLeft)
  }

  peerLeft(id) {
    if (this.#connections[id]) {
      this.#connections[id].close()
      delete this.#connections[id]
    }
    if (this.#localConnections[id]) {
      this.#localConnections[id].close()
      delete this.#localConnections[id]
    }
    console.log(`peer ${id} left`);
  }

  peerJoined(id, signal) {
    // RTCPeerConnection
    this.#localConnections[id] = new Peer({initiator: true, channelName: `${this.id}:${id}`, socketClient: this.socketClient, id: this.id, to: id})
    console.log(`peer ${id} joined`);
  }
}
