import SocketClient from './../../node_modules/socket-request-client/dist/es/index'
import Peer from './peer'

export default class Client {
  #peerConnection
  #connections = {}
  #stars = {}

  constructor(id, identifiers = ['peernet-v0.1.0'], stars = []) {
    this.id = id || Math.random().toString(36).slice(-12);
    if (!Array.isArray(identifiers)) identifiers = [identifiers]
    this.peerJoined = this.peerJoined.bind(this)
    this.peerLeft = this.peerLeft.bind(this)
    this.starLeft = this.starLeft.bind(this)
    this.starJoined = this.starJoined.bind(this)

    this._init(identifiers, stars)
  }

  async _init(identifiers, stars = []) {
    if (stars.length === 0) {
      stars.push('wss://star.leofcoin.org')
      stars.push('ws://localhost:44444')
    }
    this.identifiers = identifiers
    this.starsConfig = stars
    // reconnectJob()

    WRTC_IMPORT
    for (const star of stars) {
      try {
        this.socketClient = await SocketClient(star, identifiers[0])
        const id = await this.socketClient.request({url: 'id', params: {from: this.id}})
        this.socketClient.peerId = id
        this.#stars[id] = this.socketClient
      } catch (e) {
        if (stars.indexOf(star) === stars.length -1 && !this.socketClient) throw new Error(`No star available to connect`);
      }
    }
    const peers = await this.socketClient.peernet.join({id: this.id})
    for (const id of peers) {
      if (id !== this.id && !this.#connections[id]) this.#connections[id] = new Peer({channelName: `${id}:${this.id}`, socketClient: this.socketClient, id: this.id, to: id})
    }
    this.setupListeners()

    pubsub.subscribe('peer:connected', (peer) => {
      // peer.send(JSON.stringify({data: 'hello', from: this.id, to: peer.to}))
      console.log({peer: peer.to})
      console.log({id: peer.id})
      console.log({id: this.id})
    })
    pubsub.subscribe('peer:data', (data) => console.log({data}))
  }

  setupListeners() {
    this.socketClient.subscribe('peer:joined', this.peerJoined)
    this.socketClient.subscribe('peer:left', this.peerLeft)
    this.socketClient.subscribe('star:left', this.starLeft)
  }

  starJoined(id) {
    if (this.#stars[id]) {
      this.#stars[id].close()
      delete this.#stars[id]
    }
    console.log(`star ${id} joined`);
  }

  async starLeft(id) {
    if (this.#stars[id]) {
      this.#stars[id].close()
      delete this.#stars[id]
    }
    if (this.socketClient?.peerId === id) {

      this.socketClient.unsubscribe('peer:joined', this.peerJoined)
      this.socketClient.unsubscribe('peer:left', this.peerLeft)
      this.socketClient.unsubscribe('star:left', this.starLeft)
      this.socketClient.close()
      this.socketClient = undefined

      for (const star of this.starsConfig) {
        try {
          this.socketClient = await SocketClient(star, this.identifiers[0])
          if (!this.socketClient?.client?._connection.connected) return
          const id = await this.socketClient.request({url: 'id', params: {from: this.id}})
          this.#stars[id] = this.socketClient

          this.socketClient.peerId = id

          const peers = await this.socketClient.peernet.join({id: this.id})
          this.setupListeners()
          for (const id of peers) {
            if (id !== this.id) {
              // close connection
              if (this.#connections[id]) {
                if (this.#connections[id].connected) await this.#connections[id].close()
                delete this.#connections[id]
              }
              // reconnect
              if (id !== this.id) this.#connections[id] = new Peer({channelName: `${id}:${this.id}`, socketClient: this.socketClient, id: this.id, to: id})
            }

          }
        } catch (e) {
          console.log(e);
          if (this.starsConfig.indexOf(star) === this.starsConfig.length -1 && !this.socketClient) throw new Error(`No star available to connect`);
        }
      }
    }

    console.log(`star ${id} left`);


  }

  peerLeft(id) {
    if (this.#connections[id]) {
      this.#connections[id].close()
      delete this.#connections[id]
    }
    console.log(`peer ${id} left`);
  }

  peerJoined(id, signal) {
    if (this.#connections[id]) {
      if (this.#connections[id].connected) this.#connections[id].close()
      delete this.#connections[id]
    }
    // RTCPeerConnection
    this.#connections[id] = new Peer({initiator: true, channelName: `${this.id}:${id}`, socketClient: this.socketClient, id: this.id, to: id})
    console.log(`peer ${id} joined`);
  }


}
