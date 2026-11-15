import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { ml_dsa87 } from '@noble/post-quantum/ml-dsa.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha512 } from '@noble/hashes/sha2.js'
import { PqIdentity, PQ_NETWORK, pqAddress, pqPublicKey, verifyPqDigest } from '../exports/pq.js'
import { createPqGenesis, validatePqGenesis } from '../exports/pq-genesis.js'
import { verifyIdentityDigest } from '../exports/identity-signature.js'
import { signTransaction, createTransactionHash, MAX_TRANSACTION_BYTES } from '../exports/index.js'
import { TransactionMessage } from '@leofcoin/messages'
import MultiWallet from '@leofcoin/multi-wallet'
import { toBase58, fromBase58 } from '@vandeurenglenn/typed-array-utils'
import addresses from '@leofcoin/addresses'

const chain = 'lfc:' + '12'.repeat(32)
const other = 'lfc:' + '34'.repeat(32)
const utf8 = new TextEncoder()

test('ML-DSA-87 seed recovery matches the specified HKDF and separates account indices', async () => {
  const seed = randomBytes(64), saved = seed.slice()
  const a = new PqIdentity(seed), b = new PqIdentity(seed), c = new PqIdentity(seed, PQ_NETWORK, 1)
  const keySeed = hkdf(sha512, seed, utf8.encode('leofcoin:ML-DSA-87:v1'), utf8.encode('leofcoin:pq\0' + '0'), 32)
  const expected = ml_dsa87.keygen(keySeed)
  try {
    assert.deepEqual(seed, saved)
    assert.equal(a.selectedAccount, b.selectedAccount)
    assert.equal(a.selectedAccount, pqAddress(expected.publicKey))
    assert.notEqual(a.selectedAccount, c.selectedAccount)
    assert.equal(pqPublicKey(a.selectedAccount).length, 2592)
    assert.throws(() => new PqIdentity(seed, 'leofcoin'), /requires/)
    for (const index of [-1, 0.1, 2 ** 32, NaN]) assert.throws(() => new PqIdentity(seed, PQ_NETWORK, index), /uint32/)
    assert.throws(() => new PqIdentity(seed.subarray(1)), /64-byte/)
    await assert.rejects(a.sign(new Uint8Array(32)), /binding/)
    a.bindChainId(chain)
    assert.throws(() => a.bindChainId(other), /another chain/)
    await assert.rejects(a.load(undefined, true), /explicitly recovered/)
    assert.throws(() => a.export(), /Volatile/)
  } finally { a.destroy(); b.destroy(); c.destroy(); keySeed.fill(0); expected.secretKey.fill(0); seed.fill(0) }
})

test('exact canonical keys/signatures and 32-byte digests; no suffix truncation or cross-chain replay', async () => {
  const identity = new PqIdentity(randomBytes(64))
  try {
    identity.bindChainId(chain)
    const hash = randomBytes(32), sig = await identity.sign(hash)
    assert.equal(sig.length, 4627)
    assert.equal(verifyPqDigest(identity.selectedAccount, sig, hash, chain), true)
    assert.equal(verifyPqDigest(identity.selectedAccount, sig, hash, other), false)
    const tampered = hash.slice(); tampered[0] ^= 1
    assert.equal(verifyPqDigest(identity.selectedAccount, sig, tampered, chain), false)
    for (const signature of [sig.subarray(1), new Uint8Array([...sig, 0]), new Uint8Array([0, ...sig])])
      assert.equal(verifyPqDigest(identity.selectedAccount, signature, hash, chain), false)
    for (const address of [identity.selectedAccount.toUpperCase(), identity.selectedAccount + '00',
      identity.selectedAccount.slice(0, -2), identity.selectedAccount.replace('pq1', 'pq2'), 'classical']) {
      assert.throws(() => pqPublicKey(address), /canonical/)
      assert.equal(verifyPqDigest(address, sig, hash, chain), false)
    }
    await assert.rejects(identity.sign(hash.subarray(1)), /32-byte/)
    identity.destroy()
    await assert.rejects(identity.sign(hash), /live key/)
  } finally { identity.destroy() }
})

test('PQ and classical policies do not downgrade; legacy Schnorr verification is unchanged', async () => {
  const pq = new PqIdentity(randomBytes(64))
  const legacy = new MultiWallet('leofcoin')
  await legacy.generate()
  const hash = randomBytes(32)
  pq.bindChainId(chain)
  try {
    const pqSig = toBase58(await pq.sign(hash)), classicSig = toBase58(await legacy.sign(hash))
    assert.equal(await verifyIdentityDigest(pq.selectedAccount, pqSig, hash, PQ_NETWORK, chain), true)
    assert.equal(await verifyIdentityDigest(pq.selectedAccount, pqSig, hash, PQ_NETWORK), false)
    assert.equal(await verifyIdentityDigest(await legacy.address, classicSig, hash, PQ_NETWORK, chain), false)
    assert.equal(await verifyIdentityDigest(pq.selectedAccount, classicSig, hash, PQ_NETWORK, chain), false)
    assert.equal(await verifyIdentityDigest(pq.selectedAccount, pqSig, hash, 'leofcoin', chain), false)
    assert.equal(await verifyIdentityDigest(await legacy.address, classicSig, hash, 'leofcoin'), true)
    assert.equal(await verifyIdentityDigest(await legacy.address, classicSig, randomBytes(32), 'leofcoin'), false)
    const raw = { from: pq.selectedAccount, to: 'contract', method: 'transfer',
      params: [pq.selectedAccount, 1n], timestamp: 1, nonce: 1 }
    const tx = new TransactionMessage(await signTransaction(raw, pq))
    assert.ok(tx.encoded.length < MAX_TRANSACTION_BYTES)
    assert.equal(verifyPqDigest(raw.from, fromBase58(tx.decoded.signature), await createTransactionHash(tx), chain), true)
  } finally { pq.destroy() }
})

test('PQ genesis is deterministic, immutable, chain-ID verified, linked, and leaves bundled addresses alone', async () => {
  const pq = new PqIdentity(randomBytes(64)), original = structuredClone(addresses)
  try {
    const input = { creator: pq.selectedAccount, target: '1000000', initial: '100000',
      allocations: [{ address: pq.selectedAccount, amount: '100000' }] }
    const a = await createPqGenesis(input), b = await createPqGenesis(input)
    assert.deepEqual(a, b)
    assert.ok(Object.isFrozen(a) && Object.isFrozen(a.addresses) && Object.isFrozen(a.bytecodes))
    assert.deepEqual(await validatePqGenesis(JSON.parse(JSON.stringify(a))), a)
    const changed = await createPqGenesis({ ...input, target: '2000000' })
    assert.notEqual(changed.chainId, a.chainId)
    for (const corrupt of [
      { ...a, chainId: changed.chainId },
      { ...a, addresses: { ...a.addresses, validators: original.validators } },
      { ...a, bytecodes: { ...a.bytecodes, validators: a.bytecodes.nativeToken } }
    ]) await assert.rejects(validatePqGenesis(corrupt), /mismatch/)
    await assert.rejects(createPqGenesis({ ...input, creator: 'classical' }), /canonical/)
    await assert.rejects(createPqGenesis({ ...input, initial: '99999' }), /allocate/)
    assert.deepEqual(addresses, original)
  } finally { pq.destroy() }
})
