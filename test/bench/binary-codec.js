import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { encodeFrames, decodeFrames } from '@leofcoin/binary'
import legacyEncode from '@vandeurenglenn/typed-array-smart-concat'
import legacyDecode from '@vandeurenglenn/typed-array-smart-deconcat'

const iterations = Number(process.env.BENCH_ITERATIONS || 2000)
if (!Number.isSafeInteger(iterations) || iterations < 1) throw new Error('Invalid benchmark iterations')
let checksum = 0
function measure(fn, input, count) {
  const start = performance.now()
  for (let index = 0; index < count; index++) checksum = (checksum + fn(input).length) | 0
  return performance.now() - start
}
function compare(oldFn, newFn, input) {
  measure(oldFn, input, 500)
  measure(newFn, input, 500)
  const oldTimes = [],
    newTimes = []
  for (let round = 0; round < 5; round++) {
    if (round % 2 === 0) {
      oldTimes.push(measure(oldFn, input, iterations))
      newTimes.push(measure(newFn, input, iterations))
    } else {
      newTimes.push(measure(newFn, input, iterations))
      oldTimes.push(measure(oldFn, input, iterations))
    }
  }
  const median = (values) => values.sort((a, b) => a - b)[2]
  const oldMs = median(oldTimes),
    newMs = median(newTimes)
  return { oldMs: +oldMs.toFixed(2), newMs: +newMs.toFixed(2), speedup: +(oldMs / newMs).toFixed(2) }
}
const results = []
for (const count of [16, 128, 512]) {
  const frames = Array.from({ length: count }, (_, index) => new Uint8Array(64 + (index % 193)).fill(index % 256))
  const encoded = encodeFrames(frames)
  assert.deepEqual(encoded, legacyEncode(frames))
  assert.deepEqual(decodeFrames(encoded), legacyDecode(encoded))
  results.push({
    count,
    bytes: encoded.length,
    encode: compare(legacyEncode, encodeFrames, frames),
    decode: compare(legacyDecode, decodeFrames, encoded)
  })
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      iterations,
      samples: 5,
      checksum,
      results
    },
    null,
    2
  )
)
