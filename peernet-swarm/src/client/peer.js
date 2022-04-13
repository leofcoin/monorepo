import stream from 'readable-stream'
import PubSub from '@vandeurenglenn/little-this.pubsub'

export default class Peer extends stream.Duplex {
  #connection
  #ready = false
  #connecting = false
  #connected = false
  #channelReady = false
  #destroying = false
  #destroyed = false
  #isNegotiating = false
  #firstNegotiation = true

  // constructor(options = { allowHalfOpen: false }) {
constructor(options = {}) {
    super(options)

    this.offerOptions options.offerOptions
    this.initiator = options.initiator
    this.channelName = options.initiator ? options.channelName ||
      randombytes(20).toString('hex') : null

    this.pubsub = new PubSub()
    try {
      this.#connection = new wrtc.RTCPeerConnection()

      this.#connection.onicecandidate = event => this.#onIceCandidate(event)
      this.#connection.onicegatheringstatechange = () => this.#onIceStateChange()
      this.#connection.onconnectionstatechange = () => this.#onConnectionStateChange()
      this.#connection.onsignalingstatechange = () => this.#onSignalingStateChange()

      if (this.initiator) this.#setupData({
        channel: this.#connection.createDataChannel(this.channelName, options.channelConfig)
      })
     else this.#connection.ondatachannel = event => this.#setupData(event)
    } catch (e) {
      this.destroy(e)
    }
  }

  #onConnectionStateChange() {
    !this.destroyed && this.#connection.connectionState === 'failed' && this.destroy('ERR_CONNECTION_FAILURE')
  }

  async #needsNegotiation () {
    if (this.initiator || !this.#firstNegotiation) await this.#negotiate()

    this.#firstNegotiation = false
  }

  async #negotiate () {
    if (!this.#destroyed && !this.#destroying) {
      if (this.initiator) await this.#createOffer()
      else this.pubsub.publish('signal', { type: 'renegotiate', renegotiate: true })

      this.#isNegotiating = true
    }
  }


  async #onSignalingStateChange() {
    if (!this.#destroyed) {
      const signalingState = this.#connection.signalingState
      if (signalingState === 'stable') {
        this.#isNegotiating = false
        if (this.#queuedNegotiation) {
          this.#queuedNegotiation = false
          await this.#needsNegotiation()
        } else {
          this.pubsub.publish('negotiated', true)
        }
      }
      this.pubsub.publish('signalingStateChange', signalingState)
    }
  }

  async #onIceStateChange () {
   if (!this.#destroyed)  {
     const iceConnectionState = this.#connection.iceConnectionState
     const iceGatheringState = this.#connection.iceGatheringState

     this.pubsub.publish('iceStateChange', {iceConnectionState, iceGatheringState})

     if (iceConnectionState === 'connected' || iceConnectionState === 'completed') {
       this.#ready = true
       await this.#readyOrNot()
     }
     if (iceConnectionState === 'failed') this.destroy('ERR_ICE_CONNECTION_FAILURE')
     if (iceConnectionState === 'closed') this.destroy('ERR_ICE_CONNECTION_CLOSED')
   }
 }

 async #readyOrNot() {
    if (this.#ready && !this.#connecting && !this.#connected && this.#channelReady) {
      this.#connecting = true
      await this.#findCandidatePair()
    }
  }

  async #getStats() {
    try {
      const stats = await this.#connection.getStats()
      console.log(stats.entries());
      return Array.from(stats.entries()).reduce((set, entry) => {
        set.push(entry[1])
        return set
      }, [])
    } catch (e) {
      throw e
    }
  }

  whatFamily(address) {
    return address.includes(':') ? 'IPv6' : 'IPv4'
  }

  async #setSelectedCandidatePair(candidatePair) {
    let local = localCandidates[candidatePair.localCandidateId]
    let remote = remoteCandidates[candidatePair.remoteCandidateId]

    this.localAddress = local.ip || local.address
    this.localPort = Number(local.port)

    this.remoteAddress = remote.ip || remote.address
    this.remotePort = Number(remote.port)

    if (this.localAddress) this.localFamily = this.whatFamily(localAddress)
    if (this.remoteAddress) this.remoteFamily = this.whatFamily(remoteAddress)

    return true
  }

  async #findCandidatePair() {
    if (!this.#destroyed) {
      const stats = await this.#getStats()
      if (!this.#destroyed) {
        console.log(stats);
        const remoteCandidates = {}
        const localCandidates = {}
        const candidatePairs = {}
        let selectedCandidatePair = false

        for (const stat of stats) {
          const {type, id} = stat
          if (type === 'remote-candidate') remoteCandidates[id] = stat
          if (type === 'local-candidate') localCandidates[id] = stat
          if (type === 'candidate-pair') candidatePairs[id] = stat
        }

        for (const stat of stats) {
          if (stat.type === 'transport' && stat.candidateId) {
            const candidateId = stat.selectedCandidatePairId
            selectedCandidatePair = await this.#setSelectedCandidatePair(candidatePairs[candidateId])
          } else if (stat.type === 'candidate-pair' && stat.selected) {
            selectedCandidatePair = await this.#setSelectedCandidatePair(stat)
          }
        }

        if (!selectedCandidatePair &&
            (!Object.keys(candidatePairs).length ||
             Object.keys(localCandidates).length)
            ) return setTimeout(this.#findCandidatePair.bind(this), 100);

        this.#connecting = false
        this.#connected = true

        if (typeof this.#channel.bufferedAmountLowThreshold !== 'number') {
          this._interval = setInterval(() => this._onInterval(), 150)
          if (this._interval.unref) this._interval.unref()
        }

        this.this.pubsub.publish('connect', true)
      }
    }
  }

  #sendOffer(offer) {
    if (!this.destroyed) {
      offer = this.#connectionc.localDescription || offer

      this.pubsub.publish('offer', offer)
    }
  }

  async #createOffer() {
    if (!this.#destroyed) {
      const offer = await this.#connection.createOffer(this.offerOptions)
      if (!this.destroyed) {
        try {
          await this.#connection.setLocalDescription(offer)
          if (!this.#destroyed) {
            if (this.#iceComplete) this.#sendOffer(offer)
            // else this.once('_iceComplete', sendOffer)
          }
        } catch (e) {
          this.distroy('ERR_SET_LOCAL_DESCRIPTION')
        }
      }
    }
  }

  #onIceCandidate(event) {
    if (!this.destroyed && event.candidate) {
      // if (event.candidate) {
        this.pubsub.publish('signal', {
          type: 'candidate',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid
          }
        })
      // }
    // } else if (!event.candidate && !this._iceComplete) {
    //   this._iceComplete = true
    //   this.emit('_iceComplete')
    // }
    // as soon as we've received one valid candidate start timeout
    // if (event.candidate) {
    //   this.startIceCompleteTimeout()
    // }
  }

  #setupData (event) {
   if (!event.channel) {
     // In some situations `pc.createDataChannel()` returns `undefined` (in wrtc),
     // which is invalid behavior. Handle it gracefully.
     // See: https://github.com/feross/simple-peer/issues/163
     return this.destroy('ERR_DATA_CHANNEL')
   }

   this.#channel = event.channel
   this.#channel.binaryType = 'arraybuffer'

   this.channelName = this.#channel.label

   this.#channel.onmessage = event => this._onChannelMessage(event)

   this.#channel.onbufferedamountlow = () => this._onChannelBufferedAmountLow()

   this.#channel.onopen = () => this._onChannelOpen()

   this.#channel.onclose = () => this._onChannelClose()

   this.#channel.onerror = event => {
     const err = event.error instanceof Error
       ? event.error
       : new Error(`Datachannel error: ${event.message} ${event.filename}:${event.lineno}:${event.colno}`)
     this.destroy('ERR_DATA_CHANNEL')
   }

   // HACK: Chrome will sometimes get stuck in readyState "closing", let's check for this condition
   // https://bugs.chromium.org/p/chromium/issues/detail?id=882743
   let isClosing = false
   this._closingInterval = setInterval(() => { // No "onclosing" event
     if (this.#channel && this.#channel.readyState === 'closing') {
       if (isClosing) this._onChannelClose() // closing timed out: equivalent to onclose firing
       isClosing = true
     } else {
       isClosing = false
     }
   }, CHANNEL_CLOSING_TIMEOUT)
 }

}
