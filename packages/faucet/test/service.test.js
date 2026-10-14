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
test('canonical rejection never reports a successful payout', async (t) => {
  const env = await setup(t)
  const claim = await env.faucet.claim('test-a', '1')
  env.reject()
  await Promise.resolve()
  await env.faucet.flush()
  assert.equal(env.faucet.get(claim.id).state, 'failed')
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
    headers: { 'Content-Type': 'application/json', Origin: 'https://leofcoin.org' },
    body: JSON.stringify({ address: 'test-a', requestId: randomUUID() })
  })
  assert.equal(request.status, 202)
  const claim = await request.json()
  assert.equal(claim.state, 'pending')
  const receipt = await (await fetch(base + '/claims/' + claim.id)).json()
  assert.equal(receipt.hash, claim.hash)
  const replay = await fetch(base + '/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: 'test-a', requestId: claim.id })
  })
  assert.equal((await replay.json()).id, claim.id)
  assert.equal(env.payments(), 1)
  assert.equal(
    (
      await fetch(base + '/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: 'x'.repeat(3000)
      })
    ).status,
    413
  )
})
