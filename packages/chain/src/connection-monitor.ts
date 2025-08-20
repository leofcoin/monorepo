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
  #healthCheckInterval: number = 60000
  #version: string

  // event handlers to remove later
  #onOnline: (() => void) | null = null
  #onVisibilityChange: (() => void) | null = null
  #onSigcont: (() => void) | null = null

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

    // Listen for resume/network events (browser + node/electron)
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      this.#onOnline = () => {
        console.log('🌐 Network online — attempting restore')
        void this.#restoreNetwork()
      }
      window.addEventListener('online', this.#onOnline)

      this.#onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('💡 Visibility regained — attempting restore')
          void this.#restoreNetwork()
        }
      }
      document.addEventListener('visibilitychange', this.#onVisibilityChange)
    }

    if (typeof process !== 'undefined' && typeof process.on === 'function') {
      this.#onSigcont = () => {
        console.log('🔔 Process resumed (SIGCONT) — attempting restore')
        void this.#restoreNetwork()
      }
      try {
        process.on('SIGCONT', this.#onSigcont)
      } catch (e) {
        // ignore if not supported
      }
    }

    this.#checkInterval = setInterval(() => {
      this.#healthCheck()
    }, this.#healthCheckInterval)
  }

  stop() {
    if (!this.#isMonitoring) return

    this.#isMonitoring = false
    if (this.#checkInterval) {
      clearInterval(this.#checkInterval)
      this.#checkInterval = null
    }

    // remove listeners
    if (typeof window !== 'undefined') {
      if (this.#onOnline) {
        window.removeEventListener('online', this.#onOnline)
        this.#onOnline = null
      }
      if (this.#onVisibilityChange) {
        document.removeEventListener('visibilitychange', this.#onVisibilityChange)
        this.#onVisibilityChange = null
      }
    }
    if (typeof process !== 'undefined' && typeof process.removeListener === 'function' && this.#onSigcont) {
      try {
        process.removeListener('SIGCONT', this.#onSigcont)
      } catch (e) {
        // ignore
      }
      this.#onSigcont = null
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
      // Attempt to reconnect each disconnected peer sequentially to avoid racing signaling/state
      for (const peer of disconnectedPeers) {
        // small spacing between attempts to reduce signaling races
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 150))
        // eslint-disable-next-line no-await-in-loop
        await this.#attemptPeerReconnection(peer)
      }
    }

    // Publish connection status
    globalThis.pubsub?.publish('connection-status', {
      connected: connectedPeers.length,
      compatible: compatiblePeers.length,
      healthy: compatiblePeers.length > 0
    })
  }

  async #attemptPeerReconnection(peer: Peer) {
    if (!peer) return

    const peerId = (peer as any).peerId || (peer as any).id
    if (!peerId) return

    if (!this.#peerReconnectAttempts[peerId]) {
      this.#peerReconnectAttempts[peerId] = 0
    }

    if (this.#peerReconnectAttempts[peerId] >= this.#maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached for', peerId)
      this.#peerReconnectAttempts[peerId] = 0
      return
    }

    this.#peerReconnectAttempts[peerId]++
    console.log(
      `🔄 Attempting reconnection ${this.#peerReconnectAttempts[peerId]}/${this.#maxReconnectAttempts} for ${peerId}`
    )

    try {
      const peernet = globalThis.peernet
      if (!peernet) {
        console.warn('⚠️ globalThis.peernet not available')
        return
      }

      // Try targeted reconnect if available
      if (peernet.client?.reconnect) {
        try {
          await peernet.client.reconnect(peerId, peernet.stars?.[0])
          return
        } catch (err: any) {
          const msg = String(err?.message || err)
          console.warn('⚠️ Targeted reconnect failed:', msg)

          // handle signaling/state mismatches by cleaning up only that peer and retrying targeted reconnect
          if (
            msg.includes('Called in wrong state') ||
            msg.includes('setRemoteDescription') ||
            msg.includes('channelNames') ||
            msg.includes("channelNames don't match")
          ) {
            console.warn(
              '⚠️ Detected signaling/channel mismatch — cleaning up peer state and retrying targeted reconnect'
            )

            try {
              await this.#cleanupPeerState(peerId, peernet)
              // small backoff before retry
              await new Promise((r) => setTimeout(r, 150))
              await peernet.client.reconnect(peerId, peernet.stars?.[0])
              return
            } catch (retryErr: any) {
              console.warn('⚠️ Retry targeted reconnect failed:', String(retryErr?.message || retryErr))
              // fall through to non-targeted fallback below
            }
          }

          throw err
        }
      }

      // If no targeted reconnect, try start/restore
      if (peernet.start) {
        await peernet.start()
      }
    } catch (error: any) {
      console.error('❌ Reconnection failed:', error?.message || error)
      // As fallback, try full restart only if even the cleanup+retry failed
      if (globalThis.peernet) {
        await this.#performFullRestart(globalThis.peernet)
      }
    }
  }

  // helper: try to close/destroy a single peer connection and remove it from peernet's map
  async #cleanupPeerState(peerId: string, peernet: any) {
    try {
      const conns = peernet.connections || {}
      const conn =
        conns[peerId] || conns[Object.keys(conns).find((k) => k.includes(peerId) || (peerId.includes(k) as any))]
      if (!conn) return

      // close underlying RTCPeerConnection if exposed
      try {
        if (conn.pc && typeof conn.pc.close === 'function') {
          conn.pc.close()
        }
      } catch (e) {
        // ignore
      }

      // call any destroy/cleanup API on the connection object
      try {
        if (typeof conn.destroy === 'function') {
          conn.destroy()
        } else if (typeof conn.close === 'function') {
          conn.close()
        }
      } catch (e) {
        // ignore
      }

      // remove reference so reconnect path will create a fresh one
      try {
        delete peernet.connections[peerId]
      } catch (e) {
        // ignore
      }

      // small pause to let underlying sockets/RTCs settle
      await new Promise((r) => setTimeout(r, 100))
    } catch (e) {
      // ignore cleanup errors
    }
  }

  // New helper: close stale RTCPeerConnections if present and then restart peernet
  async #performFullRestart(peernet: any) {
    try {
      // Close underlying peer RTCPeerConnections if the library exposes them
      try {
        const conns = peernet.connections || {}
        for (const id of Object.keys(conns)) {
          const p = conns[id] as any
          // try to close underlying RTCPeerConnection if exposed
          if (p && p.pc && typeof p.pc.close === 'function') {
            try {
              p.pc.close()
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (e) {
        // ignore
      }

      // If the library supports stop -> start, do that to fully reset signaling state
      if (typeof peernet.stop === 'function') {
        try {
          await peernet.stop()
        } catch (e) {
          // ignore stop errors
        }
      }

      // small delay to ensure sockets/RTCs are closed
      await new Promise((r) => setTimeout(r, 250))

      if (typeof peernet.start === 'function') {
        await peernet.start()
      } else {
        console.warn('⚠️ peernet.start not available for full restart')
      }

      // reset reconnect attempts so we can try fresh
      this.#peerReconnectAttempts = {}
      console.log('✅ Full peernet restart completed')
    } catch (e) {
      console.error('❌ Full restart failed:', (e as any)?.message || e)
    }
  }

  // Called on visibility/online/resume events
  async #restoreNetwork() {
    console.log('🔁 Restoring network after resume/wake')
    // If there is a peernet instance, try a safe restore
    if (globalThis.peernet) {
      await this.#performFullRestart(globalThis.peernet)
    } else {
      // If no global peernet, attempt a normal reconnection flow
      await this.#attemptReconnection()
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

  // New: attempt reconnection flow (gentle start + sequential per-peer reconnect)
  async #attemptReconnection() {
    console.warn('⚠️ Attempting to reconnect to peers...')

    try {
      // attempt targeted reconnection for disconnected peers sequentially (avoid racing WebRTC state)
      const disconnected = this.disconnectedPeers
      for (const p of disconnected) {
        // small spacing between attempts to reduce signaling races
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 200))
        // eslint-disable-next-line no-await-in-loop
        await this.#attemptPeerReconnection(p as Peer)
      }

      // pause before next health check cycle
      await new Promise((resolve) => setTimeout(resolve, this.#reconnectDelay))
    } catch (error: any) {
      console.error('❌ Reconnection failed:', error?.message || error)

      if (this.#reconnectDelay >= 30000) {
        console.warn('⚠️ Reconnection delay reached maximum, resetting to 5 seconds')
        this.#reconnectDelay = 5000
      } else {
        // exponential-ish backoff
        this.#reconnectDelay = Math.min(this.#reconnectDelay * 1.5, 30000)
        console.warn(`⚠️ Increasing reconnection delay to ${this.#reconnectDelay} ms`)
      }
    }
  }
}
