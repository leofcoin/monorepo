// Read-only codec microbenchmark. Snapshot built binary/messages exports before changing them.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, mkdir, mkdtemp, cp, writeFile } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { encodeWire, decodeWire } from '@leofcoin/binary'
import { BlockMessage, TransactionMessage } from '@leofcoin/messages'

const root = fileURLToPath(new URL('../', import.meta.url))
if (process.argv[2] === '--snapshot') {
  const cache = join(root, 'node_modules/.cache')
  await mkdir(cache, { recursive: true })
  const snapshot = await mkdtemp(join(cache, 'leofcoin-codec-before.'))
  for (const name of ['binary', 'messages'])
    await cp(join(root, 'packages', name, 'exports'), join(snapshot, name), { recursive: true })
  const file = join(snapshot, 'messages/binary-format.js')
  const source = await readFile(file, 'utf8')
  const isolated = source.replaceAll("from '@leofcoin/binary'", "from '../binary/index.js'")
    .replaceAll('from "@leofcoin/binary"', 'from "../binary/index.js"')
  if (source === isolated) throw new Error('Could not isolate baseline binary imports')
  // Only the newly created, ignored snapshot is changed; production modules are untouched.
  await writeFile(file, isolated)
  console.log(snapshot)
  process.exit(0)
}
const directory = process.argv[2] || process.env.LEOFCOIN_CODEC_BASELINE
if (!directory) throw new Error('Pass a baseline directory containing binary/ and messages/ compiled exports; see packages/binary/README.md')
const baseline = resolve(directory)
const baselineFormat = await readFile(resolve(baseline, 'messages/binary-format.js'), 'utf8')
if (!baselineFormat.includes('../binary/index.js')) throw new Error('Baseline must isolate its binary imports; use --snapshot before rebuilding')
const beforeValues = await import(pathToFileURL(resolve(baseline, 'binary/index.js')).href)
const beforeMessages = await import(pathToFileURL(resolve(baseline, 'messages/index.js')).href)
const fingerprint = async (base, current = false) => {
  const hash = createHash('sha256')
  for (const name of ['binary', 'messages']) {
    const directory = current ? join(base, 'packages', name, 'exports') : join(base, name)
    const files = (await readdir(directory, { recursive: true })).filter(file => file.endsWith('.js')).sort()
    for (const file of files) {
      const bytes = await readFile(join(directory, file))
      hash.update(name + '/' + file + ':' + bytes.length + ':').update(bytes)
    }
  }
  return hash.digest('hex')
}
const transaction = {
  timestamp: 1793650000000, from: 'YT' + 'a'.repeat(50), to: 'B' + 'A'.repeat(51),
  method: 'transfer', params: ['YT' + 'b'.repeat(50), 1000n * 10n ** 18n],
  signature: '3'.repeat(88), nonce: 123, dependsOn: [], priority: false
}
const transactionHash = await new TransactionMessage(transaction).hash()
const block = {
  index: 123456n, previousHash: 'HNYQAS' + 'C'.repeat(52), timestamp: 1793650000000,
  reward: 380517503805175038n, fees: 640n,
  transactions: Array.from({ length: 64 }, (_, index) => transactionHash.slice(0, -2) + String(index).padStart(2, 'A')),
  validators: Array.from({ length: 4 }, (_, index) => ({ address: 'YT' + String(index).repeat(50), reward: 95000000000000000n })),
  producer: transaction.from, producerProof: '3'.repeat(88), protocolVersion: '0.5.0'
}
// Encoding fixtures, not a claim these synthetic blocks have valid consensus economics/proofs.
const status = { apiVersion: 1, chainId: 'lfc:' + 'a'.repeat(64),
  tip: { index: block.index, hash: block.previousHash, timestamp: block.timestamp, reward: block.reward, fees: block.fees },
  validators: block.validators, peers: ['p0', 'p1', 'p2', 'p3'], synced: true }
const balances = Object.fromEntries(Array.from({ length: 256 }, (_, index) =>
  ['YT' + String(index).padStart(50, '0'), 10n ** 24n + BigInt(index)]))
const content = { apiVersion: 1, chainId: status.chainId, encoded: Uint8Array.from({ length: 65536 }, (_, index) => index % 256) }
const after = { encode: value => encodeWire('rpc', value), decode: bytes => decodeWire('rpc', bytes) }
const before = { encode: value => beforeValues.encodeWire('rpc', value), decode: bytes => beforeValues.decodeWire('rpc', bytes) }
const messageCodec = Message => ({ encode: value => new Message(value).encoded, decode: bytes => new Message(bytes).decoded })
const cases = [
  ['status', status, 2000, before, after],
  ['256 balances', balances, 200, before, after],
  ['64 KiB binary content', content, 200, before, after],
  ['TransactionMessage', transaction, 1500, messageCodec(beforeMessages.TransactionMessage), messageCodec(TransactionMessage)],
  ['BlockMessage: 64 references, 4 validators', block, 200, messageCodec(beforeMessages.BlockMessage), messageCodec(BlockMessage)]
]
const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
let sink = 0
const measure = (codec, value, encoded, iterations, decode) => {
  globalThis.gc?.() // Optional --expose-gc: collection stays outside the timed region.
  const at = performance.now()
  for (let index = 0; index < iterations; index++) {
    if (decode) { const result = codec.decode(encoded); sink += result === undefined ? 0 : 1 }
    else sink += codec.encode(value).length
  }
  return (performance.now() - at) * 1000 / iterations
}
const results = []
for (const [name, value, iterations, oldCodec, newCodec] of cases) {
  const oldBytes = oldCodec.encode(value), newBytes = newCodec.encode(value)
  assert.deepEqual(newBytes, oldBytes, `${name} changed wire bytes`)
  assert.deepEqual(newCodec.decode(newBytes), oldCodec.decode(oldBytes), `${name} changed decoded values`)
  for (let index = 0; index < 150; index++) {
    oldCodec.decode(oldCodec.encode(value)); newCodec.decode(newCodec.encode(value))
  }
  const timings = [{ encode: [], decode: [] }, { encode: [], decode: [] }]
  for (let sample = 0; sample < 7; sample++) {
    // Alternate to reduce order/GC/thermal bias. Report medians, never best samples.
    for (const index of sample % 2 ? [1, 0] : [0, 1]) {
      const codec = index ? newCodec : oldCodec
      const bytes = index ? newBytes : oldBytes
      timings[index].encode.push(measure(codec, value, bytes, iterations, false))
      timings[index].decode.push(measure(codec, value, bytes, iterations, true))
    }
  }
  const stats = timings.map(value => ({ encode_us: +median(value.encode).toFixed(2), decode_us: +median(value.decode).toFixed(2) }))
  results.push({ name, bytes: newBytes.length, same_wire: true,
    wire_sha256: createHash('sha256').update(newBytes).digest('hex'), before: stats[0], after: stats[1],
    encode_speedup: +(stats[0].encode_us / stats[1].encode_us).toFixed(2),
    decode_speedup: +(stats[0].decode_us / stats[1].decode_us).toFixed(2) })
}
for (const [Old, New, value] of [[beforeMessages.BlockMessage, BlockMessage, block], [beforeMessages.TransactionMessage, TransactionMessage, transaction]])
  assert.equal(await new Old(value).hash(), await new New(value).hash(), 'Message content address changed')
console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
  baseline: relative(root, baseline), samples: 7,
  baseline_fingerprint: await fingerprint(baseline),
  current_fingerprint: await fingerprint(root, true),
  results, check: sink > 0 }, null, 2))
