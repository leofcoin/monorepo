import Peer from '@netpeer/swarm/peer'

/**
 * Connection Monitor - Monitors peer connections and handles reconnection logic
 */
export default class ConnectionMonitor {
  #isMonitoring: boolean = false
  #checkInterval: NodeJS.Timeout | null = null
  #reconnectDelay: number = 5000
  #healthCheckInterval: number = 60000
  #version: string
  #lastHealthCheckAt: number = 0
  #reconnecting: boolean = false

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
          console.log('💡 Visibility regained')
          if (this.connectedPeers.length === 0) {
            console.log('💡 Visibility regained — attempting restore')
            void this.#restoreNetwork()
          }
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
    } else if (compatiblePeers.length === 0 && connectedPeers.length > 0) {
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

    if (navigator?.onLine !== undefined) {
      return navigator.onLine
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
    if (this.#reconnecting) {
      console.log('🔁 Reconnection already in progress, skipping')
      return
    }

    this.#reconnecting = true
    console.log('🔁 Restoring network')

    try {
      const online = await this.#isOnLine(1500)
      if (!online) {
        console.warn('⚠️ No internet detected, skipping restore')
        this.#reconnecting = false
        return
      }
    } catch (e) {
      // If the probe failed for any reason, continue with restore attempt
      console.warn('⚠️ Online probe failed, proceeding with restore', (e as any)?.message || e)
    }

    try {
      // Try multiple restoration approaches
      console.log('🔄 Attempting network restoration...')

      // Approach 1: Try client.reinit if available
      if (globalThis.peernet?.client?.reinit) {
        console.log('  → Trying client.reinit()')
        try {
          await globalThis.peernet.client.reinit()
          console.log('  ✅ client.reinit() succeeded')
        } catch (e) {
          console.warn('  ⚠️ client.reinit() failed:', (e as any)?.message || e)
        }
      }

      // Approach 2: Try peernet.start if available
      if (globalThis.peernet?.start) {
        console.log('  → Trying peernet.start()')
        try {
          await globalThis.peernet.start()
          console.log('  ✅ peernet.start() succeeded')
        } catch (e) {
          console.warn('  ⚠️ peernet.start() failed:', (e as any)?.message || e)
        }
      }

      // Approach 3: Try client.connect if available
      if (
        globalThis.peernet?.client &&
        'connect' in globalThis.peernet.client &&
        typeof (globalThis.peernet.client as any).connect === 'function'
      ) {
        console.log('  → Trying client.connect()')
        try {
          await (globalThis.peernet.client as any).connect()
          console.log('  ✅ client.connect() succeeded')
        } catch (e) {
          console.warn('  ⚠️ client.connect() failed:', (e as any)?.message || e)
        }
      }

      // Approach 4: Explicitly dial star servers if available
      try {
        const networkName = globalThis.peernet?.network
        if (networkName && typeof networkName === 'string') {
          // Try to import network config
          const { default: networks } = await import('@leofcoin/networks')
          const [mainKey, subKey] = networkName.split(':')
          const networkConfig = networks?.[mainKey]?.[subKey]

          if (networkConfig?.stars && Array.isArray(networkConfig.stars)) {
            console.log('  → Attempting to dial star servers:', networkConfig.stars.join(', '))
            for (const star of networkConfig.stars) {
              try {
                if (globalThis.peernet?.client && 'dial' in globalThis.peernet.client) {
                  await (globalThis.peernet.client as any).dial(star)
                  console.log(`  ✅ Connected to star server: ${star}`)
                } else if (globalThis.peernet?.client && 'connect' in globalThis.peernet.client) {
                  // Try connect with the star URL
                  await (globalThis.peernet.client as any).connect(star)
                  console.log(`  ✅ Connected to star server: ${star}`)
                }
              } catch (e) {
                console.warn(`  ⚠️ Failed to dial ${star}:`, (e as any)?.message || e)
              }
            }
          }
        }
      } catch (e) {
        console.warn('  ⚠️ Could not load or dial star servers:', (e as any)?.message || e)
      }

      // Give it a moment to establish connections
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const connectedAfter = this.connectedPeers.length
      console.log(`🔄 Restoration complete. Connected peers: ${connectedAfter}`)
    } catch (error: any) {
      console.error('❌ Network restoration failed:', error?.message || error)
    } finally {
      this.#reconnecting = false
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
    if (this.#reconnecting) {
      console.log('⏭️ Reconnection already in progress')
      return
    }

    try {
      await this.#restoreNetwork()

      // Check if reconnection was successful
      const hasConnections = this.connectedPeers.length > 0
      if (hasConnections) {
        console.log('✅ Reconnection successful, resetting backoff delay')
        this.#reconnectDelay = 5000
      } else {
        console.warn('⚠️ Reconnection attempt completed but no peers connected')
        // Schedule retry with backoff
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
    } catch (error: any) {
      console.error('❌ Reconnection failed:', error?.message || error)

      // Schedule retry with backoff
      if (this.#reconnectDelay >= 30000) {
        this.#reconnectDelay = 5000
      } else {
        this.#reconnectDelay = Math.min(this.#reconnectDelay * 1.5, 30000)
      }

      setTimeout(() => this.#attemptReconnection(), this.#reconnectDelay)
    }
  }
}
