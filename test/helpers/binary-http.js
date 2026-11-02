import { encodeWire, decodeWire } from '@leofcoin/binary'
export const binaryResponse = (value, options = {}) => new Response(encodeWire('rpc', value), {
  ...options, headers: { 'Content-Type': 'application/octet-stream', ...options.headers }
})
export const fetchBinary = async (...args) => {
  const response = await globalThis.fetch(...args)
  response.binary = async () => {
    if (response.headers.get('content-type')?.split(';')[0] !== 'application/octet-stream') throw new Error('Expected binary HTTP response')
    return decodeWire('rpc', new Uint8Array(await response.arrayBuffer()))
  }
  return response
}
