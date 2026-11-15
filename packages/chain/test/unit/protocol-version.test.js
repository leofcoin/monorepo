import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { methods } from '../helpers/canonical-state-harness.js'
import { PROTOCOL_VERSION } from '../../src/constants.ts'
import { isBlockProtocolCompatible } from '../../src/consensus/protocol-version.ts'

test('fresh protocol accepts its patch releases and rejects all prior testnet histories', () => {
  assert.equal(isBlockProtocolCompatible('0.9.0', '0.9.0'), true)
  assert.equal(isBlockProtocolCompatible('0.9.9', '0.9.0'), true)
  for (const version of ['0.5.0', '0.6.0', '0.7.0', '0.8.0', '1.0.0', '0.9.bad', '0.9.0-extra', ''])
    assert.equal(isBlockProtocolCompatible(version, '0.9.0'), false)
})

test('version control never relabels incompatible state or masks storage failures', async () => {
  const code = `class Parent { async init() {} }
    class Versions extends Parent {
      version = PROTOCOL_VERSION
      #currentVersion = PROTOCOL_VERSION
      ${methods('../../src/version-control.ts', 'VersionControl', ['#setCurrentVersion', 'init', 'isVersionCompatible'])}
    }; return Versions`
  let version = '0.8.0', failure
  const writes = []
  const store = {
    async has() { if (failure) throw failure; return version !== undefined },
    async get() { return new TextEncoder().encode(version) },
    async put(key, value) { writes.push([key, value]) }
  }
  const Versions = new Function('globalThis', 'PROTOCOL_VERSION', 'isBlockProtocolCompatible',
    ts.transpile(code, { target: ts.ScriptTarget.ES2022 }))(
    { chainStore: store }, PROTOCOL_VERSION, isBlockProtocolCompatible)
  const instance = new Versions()
  await assert.rejects(instance.init(), /incompatible/)
  assert.deepEqual(writes, [])
  failure = new Error('version store unavailable')
  await assert.rejects(instance.init(), error => error === failure)
  assert.deepEqual(writes, [])
  failure = undefined
  version = undefined
  await instance.init()
  assert.deepEqual(writes, [['version', PROTOCOL_VERSION]])
  assert.equal(instance.isVersionCompatible('0.9.bad'), false)
  assert.equal(instance.isVersionCompatible('0.8.0'), false)
  assert.equal(instance.isVersionCompatible('0.9.9'), true)
})
