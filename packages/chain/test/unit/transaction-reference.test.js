import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'

import { TransactionMessage } from '@leofcoin/messages'

import {
  loadTransactionReference, loadTransactionReferences, resolveTransactionReference
} from '../../src/consensus/transaction-reference.ts'
import { methods } from '../helpers/canonical-state-harness.js'

const transaction = {
  from: 'sender',
  to: 'receiver',
  method: 'transfer',
  params: ['receiver', 1n],
  timestamp: 1,
  nonce: 1,
  signature: 'signature'
}

test('block validation rejects malformed transaction references before loading bodies', () => {
  const source = methods('../../src/chain.ts', 'Chain', ['#resolveBlockTransactions'])
  const ast = ts.createSourceFile('validation.ts', `class Validation { ${source} }`, ts.ScriptTarget.Latest, true)
  const checks = ast.statements[0].members[0].body.statements.slice(0, 2).map(statement => statement.getText(ast)).join('\n')
  const validate = new Function('blockMessage', ts.transpile(`${checks}\nreturn true`))
  assert.equal(validate({ decoded: { transactions: ['hash'] } }), true)
  assert.throws(() => validate({ decoded: { transactions: ['hash', 42] } }), /array of hashes/)
  assert.throws(() => validate({ decoded: { transactions: null } }), /array of hashes/)
})

test('accepts transaction bytes that match the block reference', async () => {
  const message = new TransactionMessage(transaction)
  const hash = await message.hash()

  const resolved = await resolveTransactionReference(hash, message.encoded)

  assert.equal(await resolved.hash(), hash)
  assert.equal(resolved.decoded.from, transaction.from)
  assert.equal(resolved.decoded.nonce, transaction.nonce)
})

test('rejects valid transaction bytes served for a different block reference', async () => {
  const message = new TransactionMessage(transaction)

  await assert.rejects(
    resolveTransactionReference('BA5XWRONGTRANSACTIONREFERENCE', message.encoded),
    /Transaction hash mismatch/
  )
})

test('loads pending bytes locally but falls back when a pending entry is absent or concurrently removed', async () => {
  const message = new TransactionMessage(transaction)
  const hash = await message.hash()
  let fetches = 0
  const readTransaction = async requested => {
    assert.equal(requested, hash)
    fetches++
    return message.encoded
  }
  const local = await loadTransactionReference(hash, async requested => {
    assert.equal(requested, hash)
    return message.encoded
  }, readTransaction)
  assert.equal(await local.hash(), hash)
  assert.equal(fetches, 0)
  const fallback = await loadTransactionReference(hash, async () => {
    throw new DOMException('removed during commit', 'NotFoundError')
  }, readTransaction)
  assert.equal(await fallback.hash(), hash)
  assert.equal(fetches, 1)
})

test('pending read failures and corrupt bodies fail explicitly instead of falling back', async () => {
  const message = new TransactionMessage(transaction)
  const hash = await message.hash()
  let fetches = 0
  const readTransaction = async () => { fetches++; return message.encoded }
  const failure = new Error('pool storage I/O failure')
  await assert.rejects(loadTransactionReference(hash, async () => { throw failure }, readTransaction),
    error => error === failure)
  await assert.rejects(loadTransactionReference('wrong-hash', async () => message.encoded, readTransaction),
    /Transaction hash mismatch/)
  assert.equal(fetches, 0)
})

test('loads ordered transaction references in bounded batches and verifies every body', async () => {
  const messages = Array.from({ length: 130 }, (_, index) =>
    new TransactionMessage({ ...transaction, nonce: index + 1 }))
  const hashes = await Promise.all(messages.map(message => message.hash()))
  const bodies = new Map(hashes.map((hash, index) => [hash, messages[index].encoded]))
  const sizes = []
  const loaded = await loadTransactionReferences(
    hashes,
    async keys => { sizes.push(keys.length); return keys.map(key => bodies.get(key)) },
    async () => { throw new Error('unexpected individual pending read') },
    async () => { throw new Error('unexpected remote read') }
  )
  assert.deepEqual(await Promise.all(loaded.map(message => message.hash())), hashes)
  assert.ok(sizes.length > 1)
  assert.ok(sizes.every(size => size <= 128))
  await assert.rejects(loadTransactionReferences(
    hashes.slice(0, 2), async () => [messages[0].encoded, messages[0].encoded],
    async () => { throw new Error('unexpected individual pending read') },
    async () => { throw new Error('unexpected remote read') }
  ), /Transaction hash mismatch/)
})

test('batch misses retry individually, while storage failures and invalid results fail explicitly', async () => {
  const messages = [1, 2].map(nonce => new TransactionMessage({ ...transaction, nonce }))
  const hashes = await Promise.all(messages.map(message => message.hash()))
  let fetches = 0
  const readPending = async hash => {
    if (hash === hashes[1]) throw new DOMException('removed', 'NotFoundError')
    return messages[0].encoded
  }
  const readRemote = async hash => { fetches++; assert.equal(hash, hashes[1]); return messages[1].encoded }
  const loaded = await loadTransactionReferences(hashes,
    async () => { throw new DOMException('missing', 'NotFoundError') }, readPending, readRemote)
  assert.deepEqual(await Promise.all(loaded.map(message => message.hash())), hashes)
  assert.equal(fetches, 1)
  const failure = new Error('disk failure')
  await assert.rejects(loadTransactionReferences(hashes, async () => { throw failure }, readPending, readRemote),
    error => error === failure)
  await assert.rejects(loadTransactionReferences(hashes, async () => [messages[0].encoded], readPending, readRemote),
    /batch.*result/i)
  await assert.rejects(loadTransactionReferences(hashes, async () => Array(2), readPending, readRemote),
    /batch.*result/i)
  await assert.rejects(loadTransactionReferences(hashes, async () => undefined, readPending, readRemote),
    /batch.*result/i)
  await assert.rejects(loadTransactionReferences(hashes,
    async () => { throw new DOMException('missing', 'NotFoundError') },
    async () => { throw failure }, readRemote), error => error === failure)
})
