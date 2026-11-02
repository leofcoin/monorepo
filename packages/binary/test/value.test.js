import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeValue, encodeValueWithPrefix, decodeValue, encodeWire, decodeWire } from '../exports/index.js'
import { encodeReferenceValue } from './reference-value.js'

test('canonical values preserve native types without JSON or decimal BigInt wrappers', () => {
  const value = { z: new Uint8Array([0, 255, 42]), a: [null, undefined, true, false, -0, -1.5, 1n << 200n, -19n, '€😀'] }
  assert.deepEqual(decodeValue(encodeValue(value)), value)
  assert.deepEqual(encodeValue({ z: 1n, a: 2 }), encodeValue({ a: 2, z: 1n }))
  assert.deepEqual(decodeWire('worker', encodeWire('worker', value)), value)
  assert.throws(() => decodeWire('rpc', encodeWire('worker', value)))
  assert.equal(encodeValue(1n << 200n).length < String(1n << 200n).length, true)
})

test('binary input fails closed for text, legacy JSON, malformed and ambiguous values', () => {
  for (const value of ['{}', {}, [1, 2], new TextEncoder().encode('{"$bigint":"1"}'), new Uint8Array()])
    assert.throws(() => decodeValue(value))
  for (const value of [NaN, Infinity, () => {}, new Date(), '\ud800', new Array(3), { get a() { throw new Error('must not run') } }])
    assert.throws(() => encodeValue(value))
  const cycle = {}; cycle.self = cycle
  assert.throws(() => encodeValue(cycle))
  const valid = encodeValue({ a: [1n, new Uint8Array([42])] })
  for (let index = 0; index < valid.length; index++) assert.throws(() => decodeValue(valid.subarray(0, index)))
  assert.throws(() => decodeValue(new Uint8Array([...valid, 0])))
  assert.throws(() => encodeValue('too large', { maxBytes: 5 }))
  assert.throws(() => decodeValue(valid, { maxNodes: 2 }))
  assert.throws(() => encodeValue([[[]]], { maxDepth: 1 }))
  assert.throws(() => decodeValue(new Uint8Array([76, 70, 67, 1, 6, 0])))
  assert.throws(() => decodeValue(new Uint8Array([76, 70, 67, 1, 9, 0x80, 0])))
})

test('map keys cannot mutate prototypes', () => {
  const value = Object.create(null)
  value.__proto__ = { polluted: true }
  const decoded = decodeValue(encodeValue(value))
  assert.equal(Object.getPrototypeOf(decoded), Object.prototype)
  assert.equal(decoded.__proto__.polluted, true)
  assert.equal({}.polluted, undefined)
})

test('single-buffer encoder retains the preceding encoder bytes for boundary and generated values', () => {
  let seed = 0x12345678
  const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0 }
  const strings = ['', 'ascii', '\0\n', '\uFEFF', 'é€😀', '\uD7FF\uE000\uFFFF', '𐀀􏿿']
  const scalar = () => [undefined, null, false, true, -0, (next() - 0x80000000) / 17,
    BigInt(next()) << BigInt(next() % 220), -BigInt(next()), strings[next() % strings.length],
    Uint8Array.from({ length: next() % 31 }, () => next() % 256)][next() % 10]
  const generated = depth => {
    if (!depth || next() % 3 === 0) return scalar()
    if (next() % 2) return Array.from({ length: next() % 5 }, () => generated(depth - 1))
    const value = Object.create(next() % 2 ? null : Object.prototype)
    for (let index = 0, count = next() % 5; index < count; index++)
      Object.defineProperty(value, `${strings[next() % strings.length]}${index}`, { value: generated(depth - 1), enumerable: true })
    return value
  }
  const values = [...strings, 0n, (1n << 256n) - 1n, -((1n << 256n) - 1n), Number.MIN_VALUE, Number.MAX_VALUE,
    new Uint8Array(16384), Buffer.from([255, 0, 42]).subarray(1), ...Array.from({ length: 1500 }, () => generated(4))]
  for (const value of values) assert.deepEqual(encodeValue(value), encodeReferenceValue(value))
  for (let bit = 0n; bit < 256n; bit++) {
    for (const value of [(1n << bit) - 1n, 1n << bit, -((1n << bit) - 1n), -(1n << bit)])
      assert.deepEqual(encodeValue(value), encodeReferenceValue(value))
  }
  for (const value of ['\uD800', '\uDC00', '\uDBFFx', 'x\uDFFF', '\uDC00\uD800', 1n << 256n, -(1n << 256n)]) {
    assert.throws(() => encodeReferenceValue(value))
    assert.throws(() => encodeValue(value))
  }
})

test('byte/depth/node budgets remain identical at their exact boundaries', () => {
  const value = { a: ['é😀', 128n, Uint8Array.of(1, 2)] }
  const size = encodeReferenceValue(value).length
  assert.deepEqual(encodeValue(value, { maxBytes: size }), encodeReferenceValue(value, { maxBytes: size }))
  for (const options of [{ maxBytes: size - 1 }, { maxNodes: 4 }, { maxDepth: 1 }]) {
    assert.throws(() => encodeReferenceValue(value, options))
    assert.throws(() => encodeValue(value, options))
  }
})

test('validation and writing allocate one output byte buffer, also with codec framing', t => {
  const value = { a: [1, -2n, 'abc', '€😀'], data: Uint8Array.of(1, 2, 3) }
  const prefix = Uint8Array.of(0xed, 0xc4, 1)
  const expected = encodeReferenceValue(value)
  const Original = Uint8Array
  const allocations = []
  t.mock.method(globalThis, 'Uint8Array', new Proxy(Original, {
    construct(target, args) { allocations.push(args[0]); return Reflect.construct(target, args) }
  }))
  const output = encodeValueWithPrefix(value, prefix, { maxBytes: expected.length })
  assert.deepEqual(allocations, [prefix.length + expected.length])
  t.mock.restoreAll()
  assert.deepEqual(output.subarray(0, prefix.length), prefix)
  assert.deepEqual(output.subarray(prefix.length), expected)
  output[0] = 0
  output[output.length - 1] = 0
  assert.equal(prefix[0], 0xed)
  assert.deepEqual(value.data, Uint8Array.of(1, 2, 3))
})
