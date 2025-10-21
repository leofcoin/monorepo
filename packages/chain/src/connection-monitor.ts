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
  #lastHealthCheckAt: number = 0

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

    // prime last check timestamp and start periodic checks
    this.#lastHealthCheckAt = Date.now()
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
    const now = Date.now()
    const expectedNext = this.#lastHealthCheckAt + this.#healthCheckInterval
    const drift = now - expectedNext
    this.#lastHealthCheckAt = now

    // Detect large timer drift (common after sleep) and proactively attempt restore
    if (drift > 5000) {
      console.log(`⏰ Detected timer drift of ${drift}ms (likely system sleep) — attempting restore`)
      // Fire and forget; normal reconnection/backoff still applies below
      void this.#restoreNetwork()
    }

    const connectedPeers = this.connectedPeers
    const compatiblePeers = this.compatiblePeers

    console.log(`🔍 Health check: ${connectedPeers.length} connected, ${compatiblePeers.length} compatible`)

    // If we have no connections or none are compatible, try to reconnect
    if (connectedPeers.length === 0) {
      console.warn('⚠️ No peer connections detected — attempting reconnection')
      await this.#attemptReconnection()
    } else if (compatiblePeers.length === 0) {
      console.warn('⚠️ No compatible peers found — attempting reconnection')
      await this.#attemptReconnection()
    }
    // Publish connection status
    globalThis.pubsub?.publish('connection-status', {
      connected: connectedPeers.length,
      compatible: compatiblePeers.length,
      healthy: compatiblePeers.length > 0
    })
  }

  // lightweight TCP probe to detect internet connectivity in Node.js
  async #isOnLine(timeout = 1500): Promise<boolean> {
    // If not running in Node, fallback to navigator.onLine if available, otherwise assume online
    if (typeof process === 'undefined') {
      if (navigator?.onLine !== undefined) {
        return navigator.onLine
      }
      return true
    }

    return new Promise(async (resolve) => {
      try {
        // lazy require so bundlers / browser builds don't break
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const net = await import('net')
        const socket = new net.Socket()
        let finished = false
        const finish = (val: boolean) => {
          if (finished) return
          finished = true
          try {
            socket.destroy()
          } catch (e) {
            // ignore
          }
          resolve(val)
        }

        socket.setTimeout(timeout)
        socket.once('connect', () => finish(true))
        socket.once('error', () => finish(false))
        socket.once('timeout', () => finish(false))

        // connect to Cloudflare DNS (1.1.1.1) on TCP/53 — fast and reliable
        socket.connect(53, '1.1.1.1')
      } catch (e) {
        resolve(false)
      }
    })
  }

  // Called on visibility/online/resume events
  async #restoreNetwork() {
    console.log('🔁 Restoring network')

    try {
      const online = await this.#isOnLine(1500)
      if (!online) {
        console.warn('⚠️ No internet detected, skipping restore')
        return
      }
    } catch (e) {
      // If the probe failed for any reason, continue with restore attempt
      console.warn('⚠️ Online probe failed, proceeding with restore', (e as any)?.message || e)
    }

    try {
      // prefer safe client reinit if available
      console.log('🔄 Attempting to reinitialize peernet client')
      await globalThis.peernet.client.reinit()
    } catch (e) {
      console.warn(
        '⚠️ peernet.client.reinit failed, falling back to peernet.start if available',
        (e as any)?.message || e
      )
      try {
        await globalThis.peernet.start()
      } catch (err) {
        console.error('❌ peernet.start also failed during restore', (err as any)?.message || err)
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

  async #attemptReconnection() {
    try {
      await this.#restoreNetwork()
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

      setTimeout(() => this.#attemptReconnection(), this.#reconnectDelay)
    }
  }
}
