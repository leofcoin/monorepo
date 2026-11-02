import { WebSocketServer } from 'ws'
import { encodeWire, decodeWire } from '@leofcoin/binary'

export default function binarySocketServer({ port, protocol }, routes) {
  const required = `${protocol}.lfc-binary-v1`
  const server = new WebSocketServer({ port, maxPayload: 4 * 1024 * 1024,
    handleProtocols: protocols => protocols.has(required) ? required : false })
  server.on('connection', socket => {
    if (socket.protocol !== required) { socket.close(1002, 'Binary protocol required'); return }
    let active = 0
    socket.on('error', () => {})
    socket.on('message', async (bytes, binary) => {
      if (!binary || !(bytes instanceof Uint8Array)) { socket.close(1003, 'Binary frames required'); return }
      let request
      try {
        request = decodeWire('rpc-request', bytes, { maxBytes: 1048576 })
        if (!request || typeof request.id !== 'string' || request.id.length > 80 || !request.id ||
          typeof request.url !== 'string' || !Object.hasOwn(routes, request.url)) throw new Error('Invalid RPC request')
      } catch { socket.close(1002, 'Invalid binary RPC'); return }
      const send = (value, status = 200) => {
        if (socket.readyState === 1) socket.send(encodeWire('rpc-response', { id: request.id, status, value }, { maxBytes: 4 * 1024 * 1024 }))
      }
      if (active >= 32) { send({ error: 'Too many pending requests' }, 429); return }
      active++
      try {
        const context = { send }
        await routes[request.url](...(request.params === undefined ? [context] : [request.params, context]))
      } catch { try { send({ error: 'RPC operation failed' }, 500) } catch { socket.close(1011) } }
      finally { active-- }
    })
  })
  return server
}
