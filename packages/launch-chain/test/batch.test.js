import assert from 'node:assert/strict'
import test from 'node:test'
import addresses from '@leofcoin/addresses'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { formatUnits, parseUnits } from '@leofcoin/utils'
import { interactiveBatch } from '../exports/batch.js'

const fixture = async (answers = ['10', '', '', '3', 'yes', 'SEND'], options = {}) => {
  const logs = [], prompts = [], entries = [], signed = [], submitted = []
  let active = 0, maximum = 0, closed = false, opened = false, nonceReads = 0, balanceReads = 0
  const wallet = {
    account: 'available-wallet',
    identity: async () => createChainIdentity(options.network ?? 'leofcoin:peach', addresses),
    connected: () => options.connected !== false,
    balance: async () => { balanceReads++; return options.balance?.(balanceReads) ?? 10n ** 30n },
    nonce: async () => { nonceReads++; return options.nonce?.(nonceReads) ?? 7 },
    parseAmount: value => parseUnits(value),
    formatAmount: value => formatUnits(value),
    sign: async (nonce, to, amount) => {
      signed.push(nonce)
      return { from: 'available-wallet', to: addresses.nativeToken, method: 'transfer',
        params: [to, amount], nonce, timestamp: 1000, signature: 'fixture-signature' }
    },
    submit: async tx => {
      assert.equal(opened, true)
      assert.equal(signed.length, Number(answers[0]), 'entire batch is signed before sending')
      assert.ok(entries.some(entry => entry.status === 'attempting' && entry.nonce === tx.nonce))
      submitted.push(tx)
      active++; maximum = Math.max(maximum, active)
      await new Promise(resolve => setImmediate(resolve))
      active--
      if (options.fail) throw new Error('fixture admission failed')
      return { hash: `tx-${tx.nonce}`, wait: options.wait ?? new Promise(() => {}) }
    }
  }
  const interaction = {
    question: async prompt => {
      prompts.push(prompt)
      assert.ok(prompts.length <= answers.length, 'unexpected question')
      return answers[prompts.length - 1]
    },
    log: message => logs.push(message),
    createJournal: async () => {
      opened = true
      return { path: 'fixture-journal', append: async entry => entries.push(entry),
        close: async () => { closed = true } }
    }
  }
  return { wallet, interaction, logs, prompts, entries, signed, submitted,
    get maximum() { return maximum }, get closed() { return closed }, get opened() { return opened } }
}

test('interactive batch uses available wallet, defaults to self and one atom, and does not wait for finalization', async () => {
  const f = await fixture()
  await interactiveBatch(f.wallet, f.interaction)
  assert.equal(f.submitted.length, 10)
  assert.equal(f.maximum, 3)
  assert.equal(f.closed, true)
  assert.deepEqual(f.signed, Array.from({ length: 10 }, (_, index) => index + 8))
  assert.ok(f.submitted.every(tx => tx.params[0] === f.wallet.account && tx.params[1] === 1n))
  assert.deepEqual(f.entries.at(-1), { status: 'admitted', requested: 10, attempted: 10, admitted: 10, unsent: 0, finalized: false })
  assert.ok(f.logs.some(log => log.includes('available-wallet')))
})

test('both interactive confirmations default to cancelling without submission', async () => {
  for (const answers of [['', '', '', '', ''], ['4', '', '', '', 'yes', 'no']]) {
    const f = await fixture(answers)
    await interactiveBatch(f.wallet, f.interaction)
    assert.equal(f.submitted.length, 0)
    assert.equal(f.opened, false)
    assert.ok(f.logs.some(log => log.includes('cancelled')))
  }
})

test('mainnet and offline nodes are blocked before interactive questions', async () => {
  for (const options of [{ network: 'leofcoin' }, { connected: false }]) {
    const f = await fixture([], options)
    await assert.rejects(interactiveBatch(f.wallet, f.interaction), /Peach|connected/)
    assert.equal(f.prompts.length, 0)
    assert.equal(f.submitted.length, 0)
  }
})

test('invalid counts, amounts, concurrency and unsafe nonces fail without sending', async () => {
  for (const answers of [['0'], ['1.5'], ['9007199254740992'], ['1', '', '-1'],
    ['1', '', '', '1025']]) {
    const f = await fixture(answers)
    await assert.rejects(interactiveBatch(f.wallet, f.interaction))
    assert.equal(f.submitted.length, 0)
  }
  const f = await fixture(undefined, { nonce: () => Number.MAX_SAFE_INTEGER })
  await assert.rejects(interactiveBatch(f.wallet, f.interaction), /nonce range/)
})

test('exact fee budget, changed nonce or changed balance prevent submission', async () => {
  for (const options of [
    { balance: () => 1n }, { nonce: n => n === 1 ? 7 : 8 },
    { balance: n => n < 3 ? 10n ** 30n : 0n }
  ]) {
    const f = await fixture(undefined, options)
    await assert.rejects(interactiveBatch(f.wallet, f.interaction), /balance|nonce changed/)
    assert.equal(f.submitted.length, 0)
    assert.equal(f.opened, false)
  }
})

test('admission failures stop new work and drain in-flight submissions with explicit unknown receipts', async () => {
  const f = await fixture(undefined, { fail: true })
  await assert.rejects(interactiveBatch(f.wallet, f.interaction), /reconcile/)
  assert.equal(f.submitted.length, 3)
  assert.equal(f.entries.filter(entry => entry.status === 'unknown').length, 3)
  assert.equal(f.entries.at(-1).unsent, 7)
  assert.equal(f.closed, true)
})

test('self-transfers require one principal plus all fees, not count times recycled principal', async () => {
  const f = await fixture(['2', '', '1', '1', 'yes', 'SEND'], { balance: () => parseUnits('1') + 1000n })
  await interactiveBatch(f.wallet, f.interaction)
  assert.equal(f.submitted.length, 2)
  const external = await fixture(['2', 'recipient', '1', '1', 'yes', 'SEND'], { balance: () => parseUnits('1') + 1000n })
  await assert.rejects(interactiveBatch(external.wallet, external.interaction), /Insufficient wallet balance/)
})

test('late canonical failure is reported separately rather than treating admission as finality', async () => {
  let reject
  const wait = new Promise((_, failure) => { reject = failure })
  const f = await fixture(['1', '', '', '1', 'yes', 'SEND'], { wait })
  await interactiveBatch(f.wallet, f.interaction)
  reject(new Error('execution failed'))
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(f.logs.some(log => log.includes('failed after admission')))
})

test('journal failure blocks dispatch and closes the journal explicitly', async () => {
  const f = await fixture()
  f.interaction.createJournal = async () => ({
    path: 'failed-journal', append: async () => { throw new Error('disk full') },
    close: async () => f.logs.push('closed failed journal')
  })
  await assert.rejects(interactiveBatch(f.wallet, f.interaction), /disk full/)
  assert.equal(f.submitted.length, 0)
  assert.ok(f.logs.includes('closed failed journal'))
})
