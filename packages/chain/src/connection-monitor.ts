/**
 * Connection Monitor - Monitors peer connections and handles reconnection logic
 */
export default class ConnectionMonitor {
  #isMonitoring: boolean = false
  #checkInterval: NodeJS.Timeout | null = null
  #reconnectAttempts: number = 0
  #maxReconnectAttempts: number = 10
  #reconnectDelay: number = 5000
  #healthCheckInterval: number = 10000

  get isMonitoring() {
    return this.#isMonitoring
  }

  get connectedPeers() {
    return Object.values(globalThis.peernet?.connections || {}).filter((peer) => peer.connected)
  }

  get compatiblePeers() {
    return this.connectedPeers.filter((peer) => peer.version === this.version)
  }

  constructor(private version: string) {}

  start() {
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
      // Could attempt to find compatible peers or trigger version negotiation
    } else {
      // Reset reconnect attempts on successful connection
      this.#reconnectAttempts = 0
    }

    // Publish connection status
    globalThis.pubsub?.publish('connection-status', {
      connected: connectedPeers.length,
      compatible: compatiblePeers.length,
      healthy: compatiblePeers.length > 0
    })
  }

  async #attemptReconnection() {
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached')
      return
    }

    this.#reconnectAttempts++
    console.log(`🔄 Attempting reconnection ${this.#reconnectAttempts}/${this.#maxReconnectAttempts}`)

    try {
      // Try to restart the network
      if (globalThis.peernet?.start) {
        await globalThis.peernet.start()
      }

      // Wait a bit before next check
      await new Promise((resolve) => setTimeout(resolve, this.#reconnectDelay))
    } catch (error) {
      console.error('❌ Reconnection failed:', error.message)

      // Exponential backoff
      this.#reconnectDelay = Math.min(this.#reconnectDelay * 1.5, 30000)
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
