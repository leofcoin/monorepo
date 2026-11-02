import { encodeWire, decodeWire, BINARY_CONTENT_TYPE } from '@leofcoin/binary'
import { createServer } from 'node:http'
import { isIP } from 'node:net'
import { FaucetError } from './service.js'

export function faucetServer(faucet, { origins = [], trustProxy = false } = {}) {
  const allowed = new Set(origins)
  const clients = new Map()
  return createServer(async (request, response) => {
    const send = (status, value) => {
      response.writeHead(status, { 'Content-Type': BINARY_CONTENT_TYPE, 'Cache-Control': 'no-store' })
      response.end(encodeWire('rpc', value))
    }
    try {
      const origin = request.headers.origin
      if (origin && !allowed.has(origin)) throw new FaucetError(403, 'Origin is not allowed')
      if (origin) {
        response.setHeader('Access-Control-Allow-Origin', origin)
        response.setHeader('Vary', 'Origin')
      }
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      const socketIp = request.socket.remoteAddress
      const forwarded =
        trustProxy && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(socketIp)
          ? request.headers['x-real-ip']
          : undefined
      const ip = typeof forwarded === 'string' && isIP(forwarded) ? forwarded : socketIp.replace(/^::ffff:/, '')
      const now = Date.now()
      for (const [key, value] of clients) if (value.until < now) clients.delete(key)
      const rate = clients.get(ip) || { count: 0, until: now + 60000 }
      if (++rate.count > 60 || clients.size > 10000) throw new FaucetError(429, 'Too many requests', 60)
      clients.set(ip, rate)
      if (request.method === 'OPTIONS') {
        response.writeHead(204)
        response.end()
        return
      }
      const path = new URL(request.url, 'http://faucet').pathname
      if (request.method === 'GET' && path === '/status') {
        const status = await faucet.status()
        send(200, status)
        return
      }
      if (request.method === 'GET' && /^\/claims\/[a-f0-9-]{36}$/.test(path)) {
        send(200, faucet.get(path.slice(8)))
        return
      }
      if (request.method !== 'POST' || path !== '/claims') throw new FaucetError(404, 'Not found')
      if (request.headers['content-type']?.split(';')[0] !== BINARY_CONTENT_TYPE)
        throw new FaucetError(415, 'Use application/octet-stream')
      const chunks = []
      let size = 0
      for await (const chunk of request) {
        size += chunk.length
        if (size > 2048) throw new FaucetError(413, 'Request too large')
        chunks.push(chunk)
      }
      let value
      try {
        value = decodeWire('rpc', Buffer.concat(chunks), { maxBytes: 2048 })
      } catch {
        throw new FaucetError(400, 'Invalid binary request')
      }
      if (!value || typeof value.address !== 'string' || value.address.length > 100)
        throw new FaucetError(400, 'Recipient address required')
      if (
        value.requestId !== undefined &&
        (typeof value.requestId !== 'string' ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.requestId))
      )
        throw new FaucetError(400, 'Invalid request ID')
      const claim = await faucet.claim(value.address.trim(), ip, value.requestId)
      send(202, claim)
    } catch (error) {
      if (error.retryAfter) response.setHeader('Retry-After', String(error.retryAfter))
      send(error.status || 500, {
        error: error.status ? error.message : 'Faucet request failed',
        accepted: Boolean(error.claimId),
        ...(error.claimId ? { claimId: error.claimId } : {})
      })
    }
  })
}
