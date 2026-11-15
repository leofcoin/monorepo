import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PqIdentity, PQ_NETWORK } from '@leofcoin/lib/pq'
import { createPqGenesis } from '@leofcoin/lib/pq-genesis'
import { signConsensusMessage, verifyConsensusMessage } from '../../src/consensus/signature.ts'
import { signBeaconActivationMessage, verifyBeaconActivationMessage } from '../../src/consensus/beacon-wire.ts'
import { chainDiscoveryOptions } from '../../exports/star-namespace.js'
import { toBase58 } from '@vandeurenglenn/typed-array-utils'

const run = promisify(execFile)
const chainId = 'lfc:' + '12'.repeat(32)
const otherId = 'lfc:' + '34'.repeat(32)

test('all consensus vote kinds and beacon identity messages enforce PQ context and type separation', async () => {
  const identity = new PqIdentity(randomBytes(64))
  identity.bindChainId(chainId)
  try {
    const message = { from: identity.selectedAccount, blockHash: 'block', index: 0n, round: 0n }
    for (const type of ['proposal', 'prevote', 'precommit']) {
      const signature = await signConsensusMessage('validators', type, message, identity)
      const signed = { ...message, signature }
      assert.equal(await verifyConsensusMessage('validators', type, signed, PQ_NETWORK, chainId), true)
      assert.equal(await verifyConsensusMessage('validators', type, signed, PQ_NETWORK, otherId), false)
      assert.equal(await verifyConsensusMessage('validators', type, signed, 'leofcoin', chainId), false)
      assert.equal(await verifyConsensusMessage('validators', type, { ...signed, round: 1n }, PQ_NETWORK, chainId), false)
      assert.equal(await verifyConsensusMessage('foreign', type, signed, PQ_NETWORK, chainId), false)
      assert.equal(await verifyConsensusMessage('validators', type === 'prevote' ? 'precommit' : 'prevote',
        signed, PQ_NETWORK, chainId), false)
    }
    const activation = { epoch: 1n, configDigest: toBase58(new Uint8Array(32)), from: identity.selectedAccount }
    const signature = await signBeaconActivationMessage('validators', activation, identity)
    assert.equal(await verifyBeaconActivationMessage('validators', { ...activation, signature }, PQ_NETWORK, chainId), true)
    assert.equal(await verifyBeaconActivationMessage('validators', { ...activation, signature }, PQ_NETWORK, otherId), false)
  } finally { identity.destroy() }
})

test('PQ discovery validates the bundle, defaults to no stars and rejects public bootstrap/foreign genesis', async () => {
  const identity = new PqIdentity(randomBytes(64))
  try {
    const genesis = await createPqGenesis({ creator: identity.selectedAccount, target: '100', initial: '100',
      allocations: [{ address: identity.selectedAccount, amount: '100' }] })
    const config = await chainDiscoveryOptions({ network: PQ_NETWORK, genesis })
    assert.deepEqual(config.stars, [])
    assert.equal(config.chainId, genesis.chainId)
    await assert.rejects(chainDiscoveryOptions({ network: PQ_NETWORK, genesis, stars: ['wss://star.leofcoin.org'] }), /local/)
    await assert.rejects(chainDiscoveryOptions({ network: PQ_NETWORK, genesis, chainId: otherId }), /genesis/)
    await assert.rejects(chainDiscoveryOptions({ network: 'leofcoin:peach', genesis }), /forbidden/)
  } finally { identity.destroy() }
})

test('real PQ node commits through votes/producer proof, restores, replays, and refuses conflicting roots', { timeout: 100000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'leofcoin-pq-'))
  const seed = randomBytes(64)
  try {
    for (const mode of ['create', 'restore', 'replay', 'conflict', 'bad-proof']) {
      try {
        const { stdout } = await run(process.execPath, ['test/pq-runtime-smoke.js', mode], {
          cwd: new URL('../..', import.meta.url),
          env: { ...process.env, LEOFCOIN_PQ_TEST_ROOT: root, LEOFCOIN_PQ_TEST_SEED: seed.toString('hex') },
          timeout: 30000, maxBuffer: 1024 * 1024
        })
        assert.match(stdout, mode === 'conflict' ? /PQ_CONFLICT_REJECTED/
          : mode === 'bad-proof' ? /PQ_BAD_PROOF_REJECTED/ : /PQ_RUNTIME_OK/)
      } catch (error) {
        // Public diagnostics only; never include the child environment/seed.
        throw new Error(`PQ ${mode} failed:\n${error.stdout ?? ''}\n${error.stderr ?? ''}`)
      }
    }
  } finally { seed.fill(0); await rm(root, { recursive: true, force: true }) }
})
