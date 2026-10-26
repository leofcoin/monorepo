import { Buffer } from 'buffer'

declare global {
  var Buffer: typeof Buffer
}

globalThis.Buffer ??= Buffer
