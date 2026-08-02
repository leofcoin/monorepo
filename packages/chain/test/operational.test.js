import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

import MultiWallet from '@leofcoin/multi-wallet'
import { createTransactionHash, signTransaction } from '@leofcoin/lib'
import {
  BlockMessage,
  PrecommitMessage,
  PrevoteMessage,
  ProposalMessage,
  TransactionMessage
} from '@leofcoin/messages'
import { fromBase58 } from '@vandeurenglenn/typed-array-utils'

const createWallet = async () => {
  const wallet = new MultiWallet('leofcoin')
  await wallet.fromPrivateKey(randomBytes(32), undefined, 'leofcoin')
  return wallet
}

const execFileAsync = promisify(execFile)

test('transaction signatures bind the sender and canonical payload', async () => {
  const signer = await createWallet()
  const from = await signer.address
  const transaction = {
    from,
    to: from,
    method: 'transfer',
    params: [from, from, 1n],
    timestamp: 1,
    nonce: 1
  }
  const signed = await signTransaction(transaction, signer)
  const message = new TransactionMessage(signed)

  const verifier = new MultiWallet('leofcoin')
  await verifier.fromAddress(from, null, 'leofcoin')
  assert.equal(
    await verifier.verify(fromBase58(message.decoded.signature), await createTransactionHash(message)),
    true
  )

  const tampered = new TransactionMessage({ ...signed, method: 'mint' })
  assert.equal(
    await verifier.verify(fromBase58(message.decoded.signature), await createTransactionHash(tampered)),
    false
  )
})

test('block encoding is deterministic and preserves consensus fields', async () => {
  const block = {
    index: 7n,
    previousHash: 'previous',
    timestamp: 123,
    reward: 150n,
    fees: 6n,
    transactions: [],
    validators: [
      { address: 'a', reward: 78n },
      { address: 'b', reward: 78n }
    ],
    producer: 'a',
    producerProof: 'proof',
    protocolVersion: '1.9.23'
  }
  const first = new BlockMessage(block)
  const second = new BlockMessage(block)

  assert.deepEqual(first.encoded, second.encoded)
  assert.equal(await first.hash(), await second.hash())

  const decoded = new BlockMessage(first.encoded).decoded
  assert.equal(decoded.index, 7n)
  assert.equal(decoded.previousHash, 'previous')
  assert.equal(decoded.producer, 'a')
  assert.equal(decoded.producerProof, 'proof')
  assert.equal(decoded.protocolVersion, '1.9.23')
  assert.deepEqual(
    decoded.validators.map(({ address, reward }) => ({ address, reward })),
    block.validators
  )
})

test('proposal, prevote, and precommit messages round-trip the same vote', () => {
  const vote = {
    blockHash: 'block',
    index: 9n,
    round: 2n,
    from: 'validator',
    signature: 'validator-signature'
  }

  for (const Message of [ProposalMessage, PrevoteMessage, PrecommitMessage]) {
    const message = new Message(vote)
    assert.deepEqual(new Message(message.encoded).decoded, vote)
  }
})

test('isolated offline nodes initialize their chain state', async () => {
  const homes = await Promise.all([
    mkdtemp(join(tmpdir(), 'leofcoin-chain-a-')),
    mkdtemp(join(tmpdir(), 'leofcoin-chain-b-'))
  ])
  try {
    const results = await Promise.all(
      homes.map((home) =>
        execFileAsync(process.execPath, ['test/runtime-smoke.js'], {
          cwd: new URL('..', import.meta.url),
          env: { ...process.env, HOME: home },
          timeout: 30_000
        })
      )
    )
    for (const { stdout, stderr } of results) {
      assert.match(stdout, /CHAIN_READY/)
      assert.match(stdout, /MACHINE_READY/)
      assert.match(stdout, /chain: 'loaded'/)
      assert.doesNotMatch(stderr, /TypeError|CHAIN_READY_TIMEOUT/)
    }
  } finally {
    await Promise.all(homes.map((home) => rm(home, { recursive: true, force: true })))
  }
})
