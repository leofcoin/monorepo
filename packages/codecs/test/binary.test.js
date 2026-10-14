import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  BinaryReader,
  BinaryWriter,
  varUintLength,
  varBigIntLength,
  encodeFrames,
  decodeFrames
} from '../exports/binary.js'

test('shared binary codec ships as a public subpath without runtime dependencies', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.deepEqual(manifest.dependencies || {}, {})
  assert.equal(manifest.exports['./binary'].import, './exports/binary.js')
  assert.equal(manifest.exports['./binary'].types, './exports/binary.d.ts')
})

function reference(value) {
  let number = BigInt(value)
  const out = []
  do {
    const byte = Number(number & 127n)
    number >>= 7n
    out.push(byte | (number ? 128 : 0))
  } while (number)
  return new Uint8Array(out)
}

test('numeric varints retain all safe-integer boundary and deterministic wire vectors', () => {
  const values = new Set([0, 1, 127, 128, 300, Number.MAX_SAFE_INTEGER])
  for (let bit = 1; bit <= 52; bit++) for (const delta of [-1, 0, 1]) values.add(2 ** bit + delta)
  let seed = 42n
  for (let i = 0; i < 1000; i++) {
    seed = (seed * 6364136223846793005n + 1n) & 9007199254740991n
    values.add(Number(seed))
  }
  for (const value of values) {
    const writer = new BinaryWriter(varUintLength(value)).writeVarUint(value)
    assert.deepEqual(writer.finish(), reference(value))
    const reader = new BinaryReader(writer.finish())
    assert.equal(reader.readVarUint(), value)
    assert.equal(reader.remaining, 0)
  }
})

test('BigInt path is exact through 256 bits and does not change numeric return types', () => {
  const values = [0n, 300n, 1n << 53n, (1n << 64n) - 1n, 10n ** 30n, (1n << 256n) - 1n]
  for (let bit = 1n; bit <= 255n; bit++) values.push((1n << bit) - 1n, 1n << bit, (1n << bit) + 1n)
  for (const value of values) {
    const writer = new BinaryWriter(varBigIntLength(value)).writeVarBigInt(value)
    assert.deepEqual(writer.finish(), reference(value))
    assert.equal(new BinaryReader(writer.finish()).readVarBigInt(), value)
  }
  assert.equal(new BinaryReader(new Uint8Array([1])).readVarUint(), 1)
  assert.equal(new BinaryReader(new Uint8Array([1])).readVarBigInt(), 1n)
})

test('framing matches established bytes, supports prefixes, empty fields and zero-copy views', () => {
  const fields = [new Uint8Array(), new Uint8Array([1, 2, 3]), new Uint8Array(128).fill(42)]
  const expected = new Uint8Array([0, 3, 1, 2, 3, 128, 1, ...fields[2]])
  assert.deepEqual(encodeFrames(fields), expected)
  const encoded = encodeFrames(fields, new Uint8Array([99]))
  assert.deepEqual(encoded, new Uint8Array([99, ...expected]))
  const decoded = decodeFrames(encoded, 1)
  assert.deepEqual(decoded, fields)
  assert.ok(decoded.every((field) => field.buffer === encoded.buffer))
  assert.deepEqual(decodeFrames(new Uint8Array()), [])
  assert.deepEqual(encodeFrames([]), new Uint8Array())
})

test('failed writes, reads and frame writes do not partially advance or mutate buffers', () => {
  const target = new Uint8Array(2).fill(99)
  const writer = new BinaryWriter(target)
  assert.throws(() => writer.writeFrame(new Uint8Array([1, 2])), RangeError)
  assert.equal(writer.position, 0)
  assert.deepEqual(target, new Uint8Array([99, 99]))
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => writer.writeVarUint(value), RangeError)
  assert.throws(() => writer.writeVarUint(1n), RangeError)
  assert.throws(() => writer.writeVarBigInt(1), TypeError)
  for (const value of [-1n, 1n << 256n]) assert.throws(() => writer.writeVarBigInt(value), RangeError)
  const reader = new BinaryReader(new Uint8Array([3, 1]))
  assert.throws(() => reader.readFrame(), RangeError)
  assert.equal(reader.position, 0)
  assert.throws(() => reader.readBytes(3), RangeError)
  assert.equal(reader.position, 0)
  assert.throws(() => new BinaryWriter(target).writeFrame(target.subarray(0, 1)), /overlaps/)
  assert.deepEqual(target, new Uint8Array([99, 99]))
})

test('truncated, overflowing and non-canonical integers are bounded and fail closed', () => {
  for (const value of [[], [128], [128, 0], new Array(1000).fill(255), [...new Array(7).fill(255), 16]]) {
    const reader = new BinaryReader(new Uint8Array(value))
    assert.throws(() => reader.readVarUint(), RangeError)
    assert.equal(reader.position, 0)
  }
  for (const value of [[], [128], [128, 0], new Array(1000).fill(255), [...new Array(36).fill(255), 16]]) {
    const reader = new BinaryReader(new Uint8Array(value))
    assert.throws(() => reader.readVarBigInt(), RangeError)
    assert.equal(reader.position, 0)
  }
  assert.equal(new BinaryReader(new Uint8Array([129, 0])).readVarUint(false), 1)
  assert.deepEqual(decodeFrames(new Uint8Array([129, 0, 99]), 0, { canonical: false }), [new Uint8Array([99])])
  assert.throws(() => decodeFrames(new Uint8Array([3, 1])), /Truncated/)
})

test('many frames use iteration rather than recursive decoding and enforce caller limits', () => {
  const fields = Array.from({ length: 20000 }, () => new Uint8Array([42]))
  const encoded = encodeFrames(fields)
  assert.deepEqual(decodeFrames(encoded), fields)
  assert.throws(() => decodeFrames(encoded, 0, { maxFrames: 10 }), /Too many/)
})

test('reader cursors are independent and writers expose explicit view/copy ownership', () => {
  const writer = new BinaryWriter(8).writeVarUint(300).writeVarBigInt(5n)
  const view = writer.finish()
  const copy = writer.finish(true)
  const first = new BinaryReader(view),
    second = new BinaryReader(view)
  assert.equal(first.readVarUint(), 300)
  assert.equal(second.readVarUint(), 300)
  assert.equal(first.readVarBigInt(), 5n)
  assert.equal(second.remaining, 1)
  writer.reset().writeVarUint(1)
  assert.equal(view[0], 1)
  assert.equal(copy[0], 172)
})
