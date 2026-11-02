import { encodeWire, decodeWire, BINARY_CONTENT_TYPE } from '@leofcoin/binary'

export const RPC_LIMIT = 4 * 1024 * 1024
export async function readBinaryRequest(request, maxBytes = 1048576) {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) throw Object.assign(new Error('Binary request too large'), { status: 413 })
    chunks.push(chunk)
  }
  return decodeWire('rpc', Buffer.concat(chunks), { maxBytes })
}

/** The Koa boundary owns serialization, including errors. Domain handlers see native values. */
export const binaryHttp = async (ctx, next) => {
  if (ctx.path === '/' && ctx.method === 'GET') return next()
  try {
    if (ctx.method === 'POST') {
      if (ctx.get('content-type').split(';')[0] !== BINARY_CONTENT_TYPE)
        throw Object.assign(new Error('Use application/octet-stream binary RPC'), { status: 415 })
      try { ctx.state.rpcParams = await readBinaryRequest(ctx.req) }
      catch (error) { throw Object.assign(error, { status: error.status || 400 }) }
      if (!ctx.state.rpcParams || typeof ctx.state.rpcParams !== 'object' || Array.isArray(ctx.state.rpcParams) || ctx.state.rpcParams instanceof Uint8Array)
        throw Object.assign(new Error('RPC parameters must be a binary map'), { status: 400 })
    } else if (ctx.method === 'GET' && !ctx.querystring) ctx.state.rpcParams = {}
    else throw Object.assign(new Error('Use binary POST parameters; JSON/query-string payloads are unsupported'), { status: 405 })
    await next()
    // Koa turns a legitimate null result into HTTP 204; binary RPC must still carry its null tag.
    if (ctx.status === 204 && ctx.body == null) ctx.status = 200
    else if (ctx.body == null) ctx.body = { error: ctx.message || 'RPC returned no value' }
  } catch (error) {
    ctx.status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500
    ctx.body = { error: ctx.status === 500 ? 'RPC operation failed' : error.message }
  }
  try { ctx.body = Buffer.from(encodeWire('rpc', ctx.body, { maxBytes: RPC_LIMIT })) }
  catch { ctx.status = 500; ctx.body = Buffer.from(encodeWire('rpc', { error: 'RPC response cannot be encoded' })) }
  ctx.type = BINARY_CONTENT_TYPE
}
