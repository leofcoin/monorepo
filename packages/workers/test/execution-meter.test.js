import assert from 'node:assert/strict'
import test from 'node:test'
import bytecodes from '@leofcoin/lib/bytecodes.json' with { type: 'json' }
import { ContractMessage } from '@leofcoin/messages'

import {
  ContractDeterminismError,
  ContractExecutionLimitError,
  ExecutionMeter,
  instrumentContractSource
} from '../exports/execution-meter.js'
import { DeterministicCrypto } from '../exports/deterministic-crypto.js'

const load = (source, limit = 100) => {
  const meter = new ExecutionMeter(limit)
  const factory = new Function('__lfcMeter', instrumentContractSource(source))
  return { Contract: factory(meter), meter }
}

test('meters function entries and every loop iteration deterministically', () => {
  const { Contract, meter } = load('return class { run() { let value = 0; for (let i = 0; i < 3; i++) value += i; return value } }')
  assert.equal(new Contract().run(), 3)
  assert.equal(meter.used, 5)
})

test('terminates an otherwise infinite contract loop at the exact unit limit', () => {
  const { Contract } = load('return class { run() { while (true) {} } }', 8)
  assert.throws(() => new Contract().run(), ContractExecutionLimitError)
})

test('meters expression-bodied arrow functions', () => {
  const { Contract, meter } = load('return class { run() { return [1, 2].map(value => value + 1) } }')
  assert.deepEqual(new Contract().run(), [2, 3])
  assert.equal(meter.used, 4)
})

test('rejects non-deterministic host globals before evaluating a contract', () => {
  for (const source of [
    'return class { run() { return new Date() } }',
    'return class { run() { return Date.parse("2020-01-01") } }',
    'return class { run() { return Math.random() } }',
    'return class { run() { return globalThis.crypto.randomUUID() } }',
    'return class { run() { return fetch("https://example.com") } }'
  ]) {
    assert.throws(() => instrumentContractSource(source), ContractDeterminismError)
  }
})

test('allows only the deterministic Web Crypto subset', () => {
  assert.doesNotThrow(() => instrumentContractSource('return class { id() { return crypto.randomUUID() } }'))
  assert.doesNotThrow(() => instrumentContractSource('return class { bytes() { return crypto.getRandomValues(new Uint8Array(8)) } }'))
  assert.throws(() => instrumentContractSource('return class { subtle() { return crypto.subtle } }'), ContractDeterminismError)
  assert.throws(() => instrumentContractSource('return class { alias() { const value = crypto; return value } }'), ContractDeterminismError)
})

test('produces reproducible random bytes and distinct sequential values', () => {
  const first = new DeterministicCrypto('finalized-beacon:transaction')
  const second = new DeterministicCrypto('finalized-beacon:transaction')
  const firstBytes = first.getRandomValues(new Uint8Array(48))
  const secondBytes = second.getRandomValues(new Uint8Array(48))
  assert.deepEqual(firstBytes, secondBytes)
  assert.notDeepEqual(first.getRandomValues(new Uint8Array(32)), firstBytes.subarray(0, 32))
})

test('creates deterministic RFC 4122 version 4 UUIDs', () => {
  const first = new DeterministicCrypto('uuid-seed').randomUUID()
  const second = new DeterministicCrypto('uuid-seed').randomUUID()
  assert.equal(first, second)
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('rejects floating-point arrays and the Web Crypto byte quota', () => {
  const crypto = new DeterministicCrypto('validation-seed')
  assert.throws(() => crypto.getRandomValues(new Float64Array(1)), TypeError)
  assert.throws(() => crypto.getRandomValues(new Uint8Array(65_537)), TypeError)
})

test('lets developers use Date.now while binding it to consensus execution time', () => {
  const meter = new ExecutionMeter(10)
  const source = instrumentContractSource('return class { now() { return Date.now() } }')
  const factory = new Function('__lfcMeter', 'Date', source)
  const Contract = factory(meter, Object.freeze({ now: () => 1234 }))
  assert.equal(new Contract().now(), 1234)
})

test('allows forbidden words when they are ordinary property names', () => {
  const { Contract } = load('return class { get Date() { return { fetch: 3 }.fetch } }')
  assert.equal(new Contract().Date, 3)
})

test('instruments every native contract bytecode accepted by genesis', () => {
  for (const encoded of Object.values(bytecodes)) {
    const message = new ContractMessage(new Uint8Array(encoded.split(',')))
    const source = new TextDecoder().decode(message.decoded.contract)
    const instrumented = instrumentContractSource(source)
    assert.doesNotThrow(() => new Function('__lfcMeter', 'Date', 'crypto', instrumented))
  }
})
