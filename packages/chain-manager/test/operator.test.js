import assert from 'node:assert/strict'
import test from 'node:test'
import { OperatorController, endpointURL, parameters } from '../dist/operator.js'
import { createChainIdentity } from '@leofcoin/lib/chain-identity'
import { createTransactionHash } from '@leofcoin/lib'
import MultiWallet from '@leofcoin/multi-wallet'
import base58 from '@vandeurenglenn/base58'
import { ContractMessage, TransactionMessage } from '@leofcoin/messages'
import { createNodeFixture } from './helpers/node-fixture.js'

const identity = await createChainIdentity('leofcoin:peach', {
  nativeToken: 'A'.repeat(52), contractFactory: 'B'.repeat(52),
  validators: 'C'.repeat(52), nameService: 'D'.repeat(52)
})
const secondIdentity = await createChainIdentity('leofcoin:mainnet', {
  ...identity.genesisContracts, nativeToken: 'E'.repeat(52)
})
const password = 'operator-test-only-password'
const memoryStorage = () => {
  const data = new Map()
  return { data, getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }
}
const warmup = new OperatorController(memoryStorage())
const encryptedBackup = await warmup.createWallet(password)
warmup.lockWallet()

async function fixture(t, { createWallet = true, testnet = true } = {}) {
  const storage = memoryStorage()
  const controller = new OperatorController(storage)
  const requests = []
  let chainIdentity = identity
  let nonce = 0
  let synced = true
  let balance = '10000000000000000000000'
  let mintRole = true
  let receiptStatus = 'pending'
  const fetchImplementation = async (input, options) => {
    const url = String(input)
    if (url.endsWith('/chainIdentity')) return Response.json(chainIdentity)
    const body = JSON.parse(options.body)
    requests.push(body)
    assert.equal(body.chainId, chainIdentity.chainId)
    assert.equal(options.credentials, 'omit')
    if (body.action === 'status') return Response.json({
      apiVersion: 1, chainId: chainIdentity.chainId, network: chainIdentity.network, height: '12',
      nativeToken: chainIdentity.genesisContracts.nativeToken, contractFactory: chainIdentity.genesisContracts.contractFactory,
      synced, peers: 2, balance, nonce
    })
    if (body.action === 'read') return Response.json({ value: ({
      tokenAmountToReceive: '1000000000000000000000',
      tokenToReceive: identity.genesisContracts.nativeToken,
      allowance: '1000000000000000000000', decimals: 18, hasRole: mintRole
    })[body.method] ?? null })
    if (body.action === 'submit') {
      const verifier = new MultiWallet('leofcoin:peach')
      await verifier.fromAddress(body.transaction.from, null, 'leofcoin:peach')
      assert.equal(await verifier.verify(base58.decode(body.transaction.signature), await createTransactionHash(body.transaction)), true)
      return Response.json({ hash: await new TransactionMessage(body.transaction).hash(), status: receiptStatus })
    }
    if (body.action === 'receipt') return Response.json({ hash: body.hash, status: receiptStatus })
    throw new Error('Unexpected management action')
  }
  const mock = t.mock.method(globalThis, 'fetch', fetchImplementation)
  await controller.discoverProfile('Peach operator', 'http://localhost:3030/', testnet)
  if (createWallet) await controller.importWallet(password, encryptedBackup)
  t.after(() => controller.lockWallet())
  return {
    controller, storage, requests, mock, fetchImplementation,
    setIdentity: value => { chainIdentity = value },
    setNonce: value => { nonce = value }, setSynced: value => { synced = value },
    setBalance: value => { balance = value }, setRole: value => { mintRole = value },
    setReceipt: value => { receiptStatus = value }
  }
}

test('profiles pin verified identity, refuse credentials, and never trust a testnet label', async t => {
  const { controller, setIdentity } = await fixture(t)
  assert.equal(controller.active.endpoint, 'http://localhost:3030')
  assert.equal(controller.active.chainId, identity.chainId)
  await assert.rejects(controller.discoverProfile('Unsafe', 'http://user:password@localhost:3031', true), /without credentials/)
  setIdentity(secondIdentity)
  await assert.rejects(controller.discoverProfile('Not a testnet', 'http://localhost:3031', true), /restricted/)
  await assert.rejects(controller.refresh(), /MISMATCH/)
  assert.equal(controller.status, undefined)
})

test('encrypted wallet is isolated, recoverable and fails closed on wrong passwords', async t => {
  const { controller, storage } = await fixture(t)
  assert.equal(controller.walletUnlocked, true)
  const publicAddress = controller.walletAddress
  controller.lockWallet()
  assert.equal(controller.walletUnlocked, false)
  await assert.rejects(controller.unlockWallet('incorrect'), /Check your password/)
  assert.equal(controller.walletUnlocked, false)
  await controller.unlockWallet(password)
  assert.equal(controller.walletAddress, publicAddress)
  assert.equal(storage.data.has('leofcoin:manager:wallet:v1'), true)
  assert.equal([...storage.data.values()].some(value => value.includes(password)), false)
  const recovered = new OperatorController(memoryStorage())
  t.after(() => recovered.lockWallet())
  await recovered.importWallet(password, controller.exportWallet())
  assert.equal(recovered.walletAddress, publicAddress)
  await assert.rejects(recovered.createWallet(password), /already exists/)
  await assert.rejects(recovered.importWallet(password, controller.exportWallet()), /already exists/)
  controller.selectProfile(controller.activeId)
  assert.equal(controller.walletUnlocked, false)
})

test('funding requires review, exact units and fees; only canonical receipts confirm', async t => {
  const { controller, requests, setReceipt } = await fixture(t)
  await controller.refresh()
  assert.equal(controller.status.balance, '10000.0')
  await controller.prepareFunding(controller.walletAddress, '1.25')
  assert.equal(controller.prepared.kind, 'fund')
  assert.deepEqual(controller.prepared.params, [controller.walletAddress, '1250000000000000000'])
  assert.match(controller.prepared.fee, /^\d/)
  assert.equal(requests.filter(request => request.action === 'submit').length, 0)
  await controller.submitPrepared()
  assert.equal(controller.prepared, undefined)
  assert.equal(controller.activity[0].status, 'pending')
  assert.equal(requests.filter(request => request.action === 'submit').length, 1)
  await assert.rejects(controller.submitPrepared(), /Prepare and review/)
  await assert.rejects(controller.prepareFunding(controller.walletAddress, '1'), /Reconcile/)
  setReceipt('confirmed')
  await controller.refreshActivity()
  assert.equal(controller.activity[0].status, 'confirmed')
  await controller.prepareFunding(controller.walletAddress, '1')
  assert.ok(controller.prepared)
})

test('submission writes history before network and never auto-retries ambiguous delivery', async t => {
  const { controller, requests, mock, storage, fetchImplementation } = await fixture(t)
  await controller.prepareFunding(controller.walletAddress, '1')
  const original = mock.mock.calls.at(-1)
  assert.ok(original)
  mock.mock.mockImplementation(async (url, options) => {
    if (String(url).endsWith('/manager/rpc') && JSON.parse(options.body).action === 'submit') {
      assert.equal(JSON.parse(storage.getItem('leofcoin:manager:activity:v1'))[0].status, 'submitting')
      throw new Error('Connection lost after admission')
    }
    return fetchImplementation(url, options)
  })
  await assert.rejects(controller.submitPrepared(), /Connection lost/)
  assert.equal(controller.activity[0].status, 'unknown')
  await assert.rejects(controller.prepareFunding(controller.walletAddress, '2'), /Reconcile/)
  assert.equal(requests.filter(request => request.action === 'submit').length, 0)
})

test('nonce changes, lost sync, low balance and chain switches block stale reviews', async t => {
  const { controller, setNonce, setSynced, setBalance, requests } = await fixture(t)
  await controller.prepareFunding(controller.walletAddress, '1')
  setNonce(1)
  await assert.rejects(controller.submitPrepared(), /nonce changed/)
  assert.equal(controller.prepared, undefined)
  setNonce(0)
  setSynced(false)
  await assert.rejects(controller.prepareFunding(controller.walletAddress, '1'), /synced/)
  setSynced(true)
  setBalance('1')
  await assert.rejects(controller.prepareFunding(controller.walletAddress, '1'), /Insufficient/)
  setBalance('10000000000000000000000')
  await controller.prepareFunding(controller.walletAddress, '1')
  controller.selectProfile(controller.activeId)
  await assert.rejects(controller.submitPrepared(), /Prepare and review/)
  assert.equal(requests.filter(request => request.action === 'submit').length, 0)
})

test('deployment binds the exact source and constructor to signed factory registration', async t => {
  const { controller, requests } = await fixture(t)
  const source = 'export default class Example { constructor(value) { this.value = value } }'
  await controller.prepareDeploy(source, '["example"]')
  const review = structuredClone(controller.prepared)
  assert.equal(review.kind, 'deploy')
  assert.equal(review.to, identity.genesisContracts.contractFactory)
  assert.equal(review.method, 'registerContract')
  const expected = new ContractMessage({ creator: controller.walletAddress, contract: source, constructorParameters: ['example'] })
  assert.equal(review.contractAddress, await expected.hash())
  assert.deepEqual(review.params, [await expected.hash()])
  await controller.submitPrepared()
  const submitted = requests.find(request => request.action === 'submit')
  assert.deepEqual(new ContractMessage(submitted.contract).encoded, expected.encoded)
  assert.equal(controller.activity[0].contractAddress, review.contractAddress)
})

test('custom mint requires testnet, role and positive exact amounts; native mint is blocked', async t => {
  const { controller, setRole } = await fixture(t)
  const customToken = 'F'.repeat(52)
  await assert.rejects(controller.prepareMint(identity.genesisContracts.nativeToken, controller.walletAddress, '1'), /cannot be manually minted/)
  await assert.rejects(controller.prepareCall(identity.genesisContracts.nativeToken, 'mint', '[]'), /protocol-controlled/)
  setRole(false)
  await assert.rejects(controller.prepareMint(customToken, controller.walletAddress, '1'), /MINT role/)
  setRole(true)
  await controller.prepareMint(customToken, controller.walletAddress, '2.5')
  assert.deepEqual(controller.prepared.params, [controller.walletAddress, '2500000000000000000'])
  assert.equal(controller.prepared.kind, 'mint')
  await assert.rejects(controller.prepareFunding(controller.walletAddress, '1e6'), /decimal/)
  await assert.rejects(controller.prepareFunding(controller.walletAddress, '0'), /positive/)
})

test('non-testnet profiles cannot access dedicated faucet or mint tools', async t => {
  const { controller } = await fixture(t, { testnet: false })
  await assert.rejects(controller.prepareFunding(controller.walletAddress, '1'), /testnet/)
  await assert.rejects(controller.prepareMint('F'.repeat(52), controller.walletAddress, '1'), /testnet/)
})

test('reviews expire at the exact two-minute boundary and never broadcast stale signatures', async t => {
  const { controller, requests } = await fixture(t)
  await controller.prepareFunding(controller.walletAddress, '1')
  const createdAt = controller.prepared.createdAt
  t.mock.method(Date, 'now', () => createdAt + 120000)
  await assert.rejects(controller.submitPrepared(), /expired/)
  assert.equal(controller.prepared, undefined)
  assert.equal(requests.filter(request => request.action === 'submit').length, 0)
})

test('wallet auto-locks and discards its prepared signature after five minutes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { controller } = await fixture(t)
  await controller.prepareFunding(controller.walletAddress, '1')
  t.mock.timers.tick(299999)
  assert.equal(controller.walletUnlocked, true)
  t.mock.timers.tick(1)
  assert.equal(controller.walletUnlocked, false)
  assert.equal(controller.prepared, undefined)
})

test('unresolved activity persists across reload and blocks removing its profile', async t => {
  const { controller, storage } = await fixture(t)
  await controller.prepareFunding(controller.walletAddress, '1')
  await controller.submitPrepared()
  assert.throws(() => controller.removeProfile(controller.activeId), /Reconcile/)
  const reloaded = new OperatorController(storage)
  assert.equal(reloaded.walletUnlocked, false)
  assert.equal(reloaded.activity[0].hash, controller.activity[0].hash)
  assert.equal(reloaded.activity[0].status, 'pending')
})

test('invalid stored data and quota errors are explicit instead of success-shaped fallbacks', async t => {
  const storage = memoryStorage()
  storage.setItem('leofcoin:manager:profiles:v1', '{')
  const controller = new OperatorController(storage)
  assert.match(controller.error, /Could not load/)
  assert.equal(storage.getItem('leofcoin:manager:profiles:v1'), '{')
  const { controller: healthy, storage: working } = await fixture(t)
  working.setItem = () => { throw new Error('Storage quota exceeded') }
  // Controller holds the storage instance, so failed persistence must prevent network submission.
  await healthy.prepareFunding(healthy.walletAddress, '1')
  await assert.rejects(healthy.submitPrepared(), /Storage quota/)
  assert.equal(healthy.activity.length, 0)
})

test('endpoint and parameter boundaries reject unsafe inputs', () => {
  assert.equal(endpointURL('https://node.example/api/'), 'https://node.example/api')
  assert.throws(() => endpointURL('file:///tmp/test'), /HTTP/)
  assert.throws(() => parameters('{}'), /JSON array/)
  assert.throws(() => parameters('["unterminated'), SyntaxError)
  assert.deepEqual(parameters('["42", true]'), ['42', true])
})

test('operator signs locally and submits a deployment and faucet funding through the actual HTTP management API', async t => {
  const node = await createNodeFixture()
  t.after(() => node.close())
  const controller = new OperatorController(memoryStorage())
  t.after(() => controller.lockWallet())
  await controller.discoverProfile('HTTP fixture', node.endpoint, true)
  await controller.importWallet(password, encryptedBackup)
  await controller.prepareDeploy('export default class Example {}', '[]')
  const address = controller.prepared.contractAddress
  await controller.submitPrepared()
  assert.equal(node.sent.length, 1)
  assert.ok(node.contracts.has(address))
  assert.equal(controller.activity[0].status, 'pending')
  await new Promise(resolve => setTimeout(resolve, 70))
  await controller.refreshActivity()
  assert.equal(controller.activity[0].status, 'confirmed')
  await controller.prepareFunding(address, '10')
  await controller.submitPrepared()
  assert.equal(node.sent.length, 2)
  assert.deepEqual(node.sent[1].params, [address, '10000000000000000000'])
  assert.equal(node.sent[1].nonce, 2)
})

test('guided faucet requires separate allowance, deployment and funding reviews and resumes after reload', async t => {
  const node = await createNodeFixture({ guidedFaucet: true })
  t.after(() => node.close())
  const storage = memoryStorage()
  let controller = new OperatorController(storage)
  t.after(() => controller.lockWallet())
  await controller.discoverProfile('Guided faucet', node.endpoint, true)
  await controller.importWallet(password, encryptedBackup)
  await assert.rejects(controller.configureFaucet('1', 59999, '1000', '100'), /Cooldown/)
  await assert.rejects(controller.configureFaucet('1', 60000, '1000', '1001'), /Budget/)
  await controller.configureFaucet('1', 60000, '1000', '100')
  const address = controller.faucetSetup.address
  assert.equal(node.sent.length, 0)
  await controller.checkFaucetSetup()
  assert.equal(controller.faucetStep, 'approval')
  await controller.prepareFaucetStep()
  assert.equal(controller.prepared.method, 'approve')
  assert.equal(controller.prepared.amount, '1000.0')
  assert.equal(controller.prepared.workflowStep, 'approval')
  assert.deepEqual(controller.prepared.params, [node.identity.genesisContracts.contractFactory, '1000000000000000000000'])
  assert.equal(node.sent.length, 0)
  await controller.submitPrepared()
  assert.equal(controller.activity[0].workflowId, controller.faucetSetup.id)
  await controller.checkFaucetSetup()
  assert.equal(controller.faucetStep, 'waiting')
  await assert.rejects(controller.prepareFaucetStep(), /canonical confirmation/)
  await new Promise(resolve => setTimeout(resolve, 80))
  await controller.refreshActivity()
  await controller.checkFaucetSetup()
  assert.equal(controller.faucetStep, 'deploy')
  await controller.prepareFaucetStep()
  assert.equal(controller.prepared.kind, 'deploy')
  assert.equal(controller.prepared.contractAddress, address)
  assert.equal(node.sent.length, 1)
  await controller.submitPrepared()
  await new Promise(resolve => setTimeout(resolve, 80))
  await controller.refreshActivity()
  controller.lockWallet()
  controller = new OperatorController(storage)
  assert.equal(controller.faucetSetup.address, address)
  await controller.unlockWallet(password)
  await controller.checkFaucetSetup()
  assert.equal(controller.faucetStep, 'fund')
  const verifiedState = node.faucetStates.get(address)
  node.faucetStates.delete(address)
  await assert.rejects(controller.prepareFaucetStep(), /does not match/)
  assert.equal(controller.prepared, undefined)
  assert.equal(node.sent.length, 2)
  node.faucetStates.set(address, verifiedState)
  await controller.prepareFaucetStep()
  assert.equal(controller.prepared.kind, 'fund')
  assert.deepEqual(controller.prepared.params, [address, '100000000000000000000'])
  assert.equal(node.sent.length, 2)
  await controller.submitPrepared()
  await new Promise(resolve => setTimeout(resolve, 80))
  await controller.refreshActivity()
  await controller.checkFaucetSetup()
  assert.equal(controller.faucetStep, 'complete')
  await assert.rejects(controller.prepareFaucetStep(), /already verified/)
  assert.equal(node.sent.length, 3)
  assert.deepEqual(node.sent.map(transaction => transaction.method), ['approve', 'registerContract', 'transfer'])
  node.faucetBalances.set(address, 0n)
  await assert.rejects(controller.checkFaucetSetup(), /cannot cover another claim/)
  assert.equal(controller.faucetStep, undefined)
})

test('saved faucet setup is chain-bound, validates restored data and never advances unknown delivery', async t => {
  const { controller, storage, setReceipt, requests, mock, fetchImplementation } = await fixture(t)
  await controller.configureFaucet('1', 60000, '100', '10')
  mock.mock.mockImplementation(async (input, options) => {
    const body = options?.body ? JSON.parse(options.body) : {}
    if (body.action === 'read' && body.method === 'tokenToReceive')
      return Response.json({ value: 'E'.repeat(52) })
    return fetchImplementation(input, options)
  })
  await assert.rejects(controller.prepareFaucetStep(), /unsupported registration token/)
  assert.equal(controller.prepared, undefined)
  assert.equal(requests.filter(request => request.action === 'submit').length, 0)
  mock.mock.mockImplementation(fetchImplementation)
  await controller.prepareFaucetStep()
  setReceipt('unknown')
  await controller.submitPrepared()
  await controller.checkFaucetSetup()
  assert.equal(controller.faucetStep, 'waiting')
  await assert.rejects(controller.prepareFaucetStep(), /canonical confirmation/)
  assert.equal(requests.filter(request => request.action === 'submit').length, 1)
  controller.faucetSetup.funding = '11.0'
  controller.faucetSetup.budget = '101.0'
  await assert.rejects(controller.checkFaucetSetup(), /does not match/)
  storage.setItem('leofcoin:manager:faucets:v1', '[{"claim":"bad"}]')
  const restored = new OperatorController(storage)
  assert.match(restored.error, /Stored faucet setups are invalid/)
})
