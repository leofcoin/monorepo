import { fetchBinary as fetch } from '../../../test/helpers/binary-http.js'
import { encodeWire } from '@leofcoin/binary'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Faucet } from '../src/service.js'
import { faucetServer } from '../src/server.js'

async function setup(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'leofcoin-faucet-test-'))
  const ledger = join(dir, 'claims.json')
  let payments = 0,
    resolve,
    reject
  const adapter = {
    validateAddress: async (address) => {
      if (!address.startsWith('test-')) throw Object.assign(new Error('Invalid address'), { status: 400 })
    },
    health: async () => ({ ready: true, account: 'faucet', balance: 10000n }),
    submit: async () => {
      payments++
      const data = JSON.parse(await readFile(ledger, 'utf8'))
      assert.equal(data.claims.at(-1).state, 'reserved')
      return {
        hash: 'tx-' + payments,
        wait: new Promise((a, b) => {
          resolve = a
          reject = b
        })
      }
    },
    ...overrides
  }
  const faucet = await new Faucet({ ledger, amount: 10n, dailyBudget: 20n, cooldownMs: 60000, adapter }).init()
  t.after(async () => {
    await faucet.flush()
    await rm(dir, { recursive: true, force: true })
  })
  return {
    faucet,
    ledger,
    adapter,
    payments: () => payments,
    resolve: () => resolve(),
    reject: () => reject(new Error('rejected'))
  }
}
test('reserves before broadcasting, stays pending, and only confirms after canonical completion', async (t) => {
  const env = await setup(t)
  const claim = await env.faucet.claim('test-a', '1.2.3.4')
  assert.equal(claim.state, 'pending')
  assert.equal(env.payments(), 1)
  assert.equal('ip' in claim, false)
  env.resolve()
  await Promise.resolve()
  await env.faucet.flush()
  assert.equal(env.faucet.get(claim.id).state, 'confirmed')
})
test('serializes duplicate concurrent claims and enforces both IP and address limits', async (t) => {
  const env = await setup(t)
  const results = await Promise.allSettled([
    env.faucet.claim('test-a', '1.2.3.4'),
    env.faucet.claim('test-a', '1.2.3.4')
  ])
  assert.equal(results.filter((value) => value.status === 'fulfilled').length, 1)
  assert.equal(env.payments(), 1)
  await assert.rejects(env.faucet.claim('test-b', '1.2.3.4'), (error) => error.status === 429)
  await assert.rejects(env.faucet.claim('test-a', '2.3.4.5'), (error) => error.status === 429)
})
test('limits total daily payouts even with different addresses and IPs', async (t) => {
  const env = await setup(t)
  await env.faucet.claim('test-a', '1')
  await env.faucet.claim('test-b', '2')
  await assert.rejects(env.faucet.claim('test-c', '3'), (error) => error.status === 429)
  assert.equal(env.payments(), 2)
})
test('replaying the same request ID recovers its receipt without another payout', async (t) => {
  const env = await setup(t)
  const id = randomUUID()
  const [first, replay] = await Promise.all([env.faucet.claim('test-a', '1', id), env.faucet.claim('test-a', '1', id)])
  assert.equal(first.id, replay.id)
  assert.equal(env.payments(), 1)
  await assert.rejects(env.faucet.claim('test-b', '2', id), (error) => error.status === 409)
})
test('restart retains pending reservations and cooldown without rebroadcasting', async (t) => {
  const env = await setup(t)
  const claim = await env.faucet.claim('test-a', '1')
  const recovered = await new Faucet({
    ledger: env.ledger,
    amount: 10n,
    dailyBudget: 20n,
    cooldownMs: 60000,
    adapter: env.adapter
  }).init()
  assert.equal(recovered.get(claim.id).state, 'pending')
  assert.equal((await recovered.claim('test-a', '1', claim.id)).id, claim.id)
  await assert.rejects(recovered.claim('test-a', '1'), (error) => error.status === 429)
  assert.equal(env.payments(), 1)
})
test('restart reconciles pending hashes in bounded canonical batches without rebroadcasting', async (t) => {
  const blocks = Array.from({ length: 131 }, (_, index) =>
    ({ index, hash: `block-${index}`, transactions: index === 129 ? ['tx-1'] : [] }))
  const env = await setup(t, {
    reconciliationReady: async () => true,
    canonicalTip: async () => blocks[130],
    canonicalBlocks: async (from, to) => blocks.slice(from, to)
  })
  const claim = await env.faucet.claim('test-a', '1')
  const recovered = await new Faucet({
    ledger: env.ledger, amount: 10n, dailyBudget: 20n, cooldownMs: 60000, adapter: env.adapter
  }).init()
  await recovered.reconcile()
  assert.equal(recovered.get(claim.id).state, 'pending')
  assert.equal(JSON.parse(await readFile(env.ledger, 'utf8')).claims[0].scanHeight, 128)
  await recovered.reconcile()
  assert.equal(recovered.get(claim.id).state, 'confirmed')
  assert.equal(env.payments(), 1)
})
test('reconciliation ignores unstable tips and rescans when the previous anchor changes', async (t) => {
  const blocks = Array.from({ length: 130 }, (_, index) =>
    ({ index, hash: `block-${index}`, transactions: [] }))
  let changing = true, calls = 0
  const env = await setup(t, {
    reconciliationReady: async () => true,
    canonicalTip: async () => changing && ++calls === 2 ? { index: 130, hash: 'changed' } : blocks[129],
    canonicalBlocks: async (from, to) => blocks.slice(from, to)
  })
  const claim = await env.faucet.claim('test-a', '1')
  await assert.rejects(env.faucet.reconcile(), /tip changed/)
  assert.equal(env.faucet.get(claim.id).state, 'pending')
  changing = false
  await env.faucet.reconcile()
  blocks[128].hash = 'replacement'
  blocks[1].transactions.push('tx-1')
  await env.faucet.reconcile()
  assert.equal(env.faucet.get(claim.id).state, 'confirmed')
  env.reject()
  await Promise.resolve()
  await env.faucet.flush()
  assert.equal(env.faucet.get(claim.id).state, 'confirmed')
  assert.equal(env.payments(), 1)
})
test('reconciliation waits for a connected synced node and rejects a mismatched tip block', async (t) => {
  let ready = false
  const env = await setup(t, {
    reconciliationReady: async () => ready,
    canonicalTip: async () => ({ index: 1, hash: 'committed' }),
    canonicalBlocks: async () => [{ index: 1, hash: 'other', transactions: ['tx-1'] }]
  })
  const claim = await env.faucet.claim('test-a', '1')
  await env.faucet.reconcile()
  ready = true
  await assert.rejects(env.faucet.reconcile(), /does not match/)
  assert.equal(env.faucet.get(claim.id).state, 'pending')
})
test('a rejected completion remains pending until canonical inclusion is established', async (t) => {
  const env = await setup(t)
  const claim = await env.faucet.claim('test-a', '1')
  env.reject()
  await Promise.resolve()
  await env.faucet.flush()
  assert.equal(env.faucet.get(claim.id).state, 'pending')
})
test('unknown submission outcome remains reserved and cannot be automatically paid again', async (t) => {
  const env = await setup(t, {
    submit: async () => {
      throw new Error('connection lost')
    }
  })
  await assert.rejects(
    env.faucet.claim('test-a', '1'),
    (error) => error.status === 503 && typeof error.claimId === 'string'
  )
  const data = JSON.parse(await readFile(env.ledger, 'utf8'))
  assert.equal(data.claims[0].state, 'reserved')
  await assert.rejects(env.faucet.claim('test-a', '1'), (error) => error.status === 429)
})
test('corrupted ledger fails closed', async (t) => {
  const env = await setup(t)
  await writeFile(env.ledger, 'invalid')
  await assert.rejects(
    new Faucet({ ledger: env.ledger, amount: 10n, dailyBudget: 20n, cooldownMs: 60000, adapter: env.adapter }).init()
  )
})
test('reserves network fees alongside pending claim amounts', async (t) => {
  const env = await setup(t, {
    health: async () => ({ ready: true, balance: 21n, account: 'faucet' }),
    quote: async () => ({ fee: 1n })
  })
  await env.faucet.claim('test-a', '1')
  await assert.rejects(env.faucet.claim('test-b', '2'), (error) => error.status === 503)
  assert.equal(env.payments(), 1)
})
test('HTTP exposes claim status, uses 202 before confirmation, rejects disallowed origins and oversized bodies', async (t) => {
  const env = await setup(t)
  const server = faucetServer(env.faucet, { origins: ['https://leofcoin.org'] })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  t.after(() => server.close())
  const base = `http://127.0.0.1:${server.address().port}`
  const request = await fetch(base + '/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', Origin: 'https://leofcoin.org' },
    body: encodeWire('rpc', { address: 'test-a', requestId: randomUUID() })
  })
  assert.equal(request.status, 202)
  const claim = await request.binary()
  assert.equal(claim.state, 'pending')
  const receipt = await (await fetch(base + '/claims/' + claim.id)).binary()
  assert.equal(receipt.hash, claim.hash)
  const replay = await fetch(base + '/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: encodeWire('rpc', { address: 'test-a', requestId: claim.id })
  })
  assert.equal((await replay.binary()).id, claim.id)
  assert.equal(env.payments(), 1)
  assert.equal(
    (
      await fetch(base + '/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: 'null'
      })
    ).status,
    400
  )
  assert.equal((await fetch(base + '/status', { headers: { Origin: 'https://untrusted.example' } })).status, 403)
  assert.equal(
    (
      await fetch(base + '/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: 'x'.repeat(3000)
      })
    ).status,
    413
  )
})

test('HTTP serves the public /faucet path whether or not the proxy strips it', async (t) => {
  const env = await setup(t)
  const server = faucetServer(env.faucet, { origins: ['https://leofcoin.org'] })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  t.after(() => server.close())
  const base = `http://127.0.0.1:${server.address().port}`
  for (const path of ['/status', '/faucet/status']) {
    const response = await fetch(base + path, { headers: { Origin: 'https://leofcoin.org' } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-leofcoin-service'), 'faucet')
    assert.equal((await response.binary()).ready, true)
  }
  const claim = await (
    await fetch(base + '/faucet/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: encodeWire('rpc', { address: 'test-a', requestId: randomUUID() })
    })
  ).binary()
  assert.equal((await (await fetch(`${base}/faucet/claims/${claim.id}`)).binary()).id, claim.id)
  for (const path of ['/faucetstatus', '/faucet/faucet/status', '/unknown']) {
    const response = await fetch(base + path)
    assert.equal(response.status, 404, path)
    assert.equal(response.headers.get('x-leofcoin-service'), 'faucet')
  }
})
