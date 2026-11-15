import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { ContractMessage } from '@leofcoin/messages'
import addresses from '@leofcoin/addresses'
import bytecodes from '@leofcoin/lib/bytecodes.json' with { type: 'json' }
import BinaryWorker from '../exports/binary-worker.js'

test('mint accounting includes canonical subsidies and restores legacy checkpoints without double counting', { timeout: 30000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'lfc-mint-accounting-'))
  const workers = []
  t.after(async () => {
    for (const worker of workers) worker.terminate()
    await rm(root, { recursive: true, force: true })
  })
  await symlink(fileURLToPath(new URL('../../../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
  const output = join(root, 'machine-worker.mjs')
  await build({ entryPoints: [fileURLToPath(new URL('../src/machine-worker.ts', import.meta.url))],
    outfile: output, bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node24', logLevel: 'silent',
    plugins: [{ name: 'bundle-bytecodes', setup(builder) {
      builder.onResolve({ filter: /^@leofcoin\/lib\/bytecodes\.json$/ }, () =>
        ({ path: fileURLToPath(new URL('../../lib/src/bytecodes.json', import.meta.url)) }))
    } }] })
  const contracts = new Map()
  for (const encoded of Object.values(bytecodes)) {
    const bytes = Uint8Array.from(encoded.split(','), Number)
    const message = new ContractMessage(bytes)
    contracts.set(await message.hash(), bytes)
  }
  const start = async input => {
    const worker = await new BinaryWorker(output)
    workers.push(worker)
    const pending = new Map()
    worker.worker.on('error', error => {
      for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(error) }
      pending.clear()
    })
    worker.onmessage(message => {
      if (message.type === 'ask') {
        const value = message.question === 'peers' ? [] : contracts.get(message.input)
        worker.postMessage({ id: message.id, input: value })
      } else if (pending.has(message.id)) {
        const { resolve, reject, timer } = pending.get(message.id)
        clearTimeout(timer)
        pending.delete(message.id)
        if (message.type.endsWith('Error')) reject(new Error(message.message))
        else if (message.type === 'response') resolve(message.value)
      }
    })
    let next = 0
    const request = (type, input) => new Promise((resolve, reject) => {
      const id = String(++next)
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Worker ${type} timed out`)) }, 8000)
      pending.set(id, { resolve, reject, timer })
      worker.postMessage({ id, type, input })
    })
    await request('init', { peerid: 'fixture', ...input })
    return request
  }
  const legacy = { index: 0, hash: 'old', previousHash: '0x0', protocolVersion: '0.2.0', reward: 150n, transactions: [] }
  const first = { index: 1, hash: 'first', previousHash: 'old', protocolVersion: '0.3.0', reward: 10n, transactions: [] }
  const next = { index: 2, hash: 'next', previousHash: 'first', protocolVersion: '0.3.0', reward: 20n, transactions: [] }
  const worker = await start({ blocks: [] })
  const initialSupply = BigInt(await worker('get', { contract: addresses.nativeToken, method: 'totalSupply', params: [] }))
  assert.equal(await worker('settleRewards', { rewards: [['fixture-validator', 10n]] }), 10n)
  assert.equal(BigInt(await worker('get', { contract: addresses.nativeToken, method: 'totalSupply', params: [] })), initialSupply + 10n)
  assert.equal(await worker('addLoadedBlock', legacy), true)
  assert.equal(await worker('addLoadedBlock', first), true)
  assert.equal(await worker('addLoadedBlock', first), false)
  assert.equal(await worker('totalMintAmount'), '10')
  assert.equal(await worker('totalMintAmountWithRewards'), '10')
  const snapshot = await worker('snapshot')
  assert.equal(snapshot.info.totalMintAmount, 0n)
  snapshot.info.totalMintAmount = 7n
  const restored = await start({ fromState: true, state: snapshot.states, info: snapshot.info,
    lastBlock: snapshot.lastBlock, blocks: [legacy, first] })
  assert.equal(await restored('totalMintAmountWithRewards'), '17')
  assert.equal(await restored('addLoadedBlock', next), true)
  assert.equal(await restored('totalMintAmountWithRewards'), '37')
  await assert.rejects(restored('addLoadedBlock', { ...next, index: 3, hash: 'bad', previousHash: 'next', reward: -1n }),
    /Invalid canonical block subsidy/)
  assert.equal(await restored('totalMintAmountWithRewards'), '37')
  const secondSnapshot = await restored('snapshot')
  const restarted = await start({ fromState: true, state: secondSnapshot.states, info: secondSnapshot.info,
    lastBlock: secondSnapshot.lastBlock, blocks: [legacy, first, next] })
  assert.equal(await restarted('totalMintAmountWithRewards'), '37')
})
