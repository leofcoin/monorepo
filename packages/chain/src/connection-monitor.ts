import Peer from '@netpeer/swarm/peer'

/**
 * Connection Monitor - Monitors peer connections and handles reconnection logic
 */
export default class ConnectionMonitor {
  #isMonitoring: boolean = false
  #checkInterval: NodeJS.Timeout | null = null
  #peerReconnectAttempts: { [peerId: string]: number } = {}
  #maxReconnectAttempts: number = 10
  #reconnectDelay: number = 5000
  #healthCheckInterval: number = 10000
  #version: string

  get isMonitoring() {
    return this.#isMonitoring
  }

  get connectedPeers() {
    return Object.values(globalThis.peernet?.connections || {}).filter((peer) => peer.connected)
  }

  get compatiblePeers() {
    return this.connectedPeers.filter((peer) => peer.version === this.#version)
  }

  get disconnectedPeers() {
    return Object.values(globalThis.peernet?.connections || {}).filter((peer) => !peer.connected)
  }

  start(version) {
    this.#version = version
    console.log(`🔗 Connection Monitor initialized for version: ${this.#version}`)

    if (this.#isMonitoring) return

    this.#isMonitoring = true
    console.log('🔄 Starting connection monitor...')

    this.#checkInterval = setInterval(() => {
      this.#healthCheck()
    }, this.#healthCheckInterval)

    // Initial health check
    this.#healthCheck()
  }

  stop() {
    if (!this.#isMonitoring) return

    this.#isMonitoring = false
    if (this.#checkInterval) {
      clearInterval(this.#checkInterval)
      this.#checkInterval = null
    }
    console.log('⏹️ Connection monitor stopped')
  }

  async #healthCheck() {
    const connectedPeers = this.connectedPeers
    const compatiblePeers = this.compatiblePeers

    console.log(`🔍 Health check: ${connectedPeers.length} connected, ${compatiblePeers.length} compatible`)

    if (connectedPeers.length === 0) {
      console.warn('⚠️ No peer connections detected')
      await this.#attemptReconnection()
    } else if (compatiblePeers.length === 0) {
      console.warn('⚠️ No compatible peers found')
      await this.#attemptReconnection()
      // Could attempt to find compatible peers or trigger version negotiation
    }

    // Log disconnected peers
    const disconnectedPeers = this.disconnectedPeers
    if (disconnectedPeers.length > 0) {
      console.warn(`⚠️ Disconnected peers: ${disconnectedPeers.map((peer) => peer.peerId).join(', ')}`)
      // Attempt to reconnect each disconnected peer
      const promises = []
      for (const peer of disconnectedPeers) {
        promises.push(this.#attemptPeerReconnection(peer))
      }
      await Promise.all(promises)
    }

    // Publish connection status
    globalThis.pubsub?.publish('connection-status', {
      connected: connectedPeers.length,
      compatible: compatiblePeers.length,
      healthy: compatiblePeers.length > 0
    })
  }

  async #attemptPeerReconnection(peer: Peer) {
    if (this.#peerReconnectAttempts[peer.peerId] >= this.#maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached')
      this.#peerReconnectAttempts[peer.peerId] = 0
    }
    if (!this.#peerReconnectAttempts[peer.peerId]) {
      this.#peerReconnectAttempts[peer.peerId] = 0
    }
    this.#peerReconnectAttempts[peer.peerId]++
    console.log(`🔄 Attempting reconnection ${this.#peerReconnectAttempts[peer.peerId]}/${this.#maxReconnectAttempts}`)

    try {
      const peerId = peer.peerId || peer.id
      // Attempt to reconnect the specific peer

      await peernet.client.reconnect(peerId, globalThis.peernet?.stars[0])
    } catch (error) {
      console.error('❌ Reconnection failed:', error.message)
    }
    //   // Try to restart the network
    //   if (globalThis.peernet?.start) {
    //     await globalThis.peernet.start()
    //   } else {
    //     console.warn('⚠️ Peernet start method not available, skipping reconnection')
    //   }
    // } catch (error) {
    //   console.error('❌ Reconnection failed:', error.message)
    // }
  }

  async #attemptReconnection() {
    console.warn('⚠️ Attempting to reconnect to peers...')

    try {
      // Try to restart the network
      // if (globalThis.peernet?.start) {
      //   await globalThis.peernet.start()
      // }

      // Wait a bit before next check
      await new Promise((resolve) => setTimeout(resolve, this.#reconnectDelay))
    } catch (error) {
      console.error('❌ Reconnection failed:', error.message)

      if (this.#reconnectDelay >= 30000) {
        console.warn('⚠️ Reconnection delay reached maximum, resetting to 5 seconds')
        this.#reconnectDelay = 5000
      } else {
        // Exponential backoff
        this.#reconnectDelay = Math.min(this.#reconnectDelay * 1.5, 30000)
        console.warn(`⚠️ Increasing reconnection delay to ${this.#reconnectDelay} ms`)
      }
    }
  }

  async waitForPeers(timeoutMs: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now()

      const checkPeers = () => {
        if (this.compatiblePeers.length > 0) {
          resolve(true)
          return
        }

        if (Date.now() - startTime >= timeoutMs) {
          resolve(false)
          return
        }

        setTimeout(checkPeers, 1000)
      }

      checkPeers()
    })
  }
}
