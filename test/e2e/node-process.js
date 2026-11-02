import { tmpdir, homedir } from 'node:os'
import { resolve, relative, isAbsolute } from 'node:path'
const explicitRoot = process.env.LEOFCOIN_E2E_ROOT
if (!explicitRoot || !relative(tmpdir(), resolve(explicitRoot)) || relative(tmpdir(), resolve(explicitRoot)).startsWith('..') || isAbsolute(relative(tmpdir(), resolve(explicitRoot))))
  throw new Error('E2E requires an explicit isolated temporary root')
const stringify = (value) => JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item))
const emit = (type, value = {}) => process.stdout.write(`E2E_EVENT:${stringify({ type, ...value })}\n`)

if (process.env.LEOFCOIN_E2E_DEBUG === '1') {
  const { setTargets } = await import('@vandeurenglenn/debug')
  setTargets(['leofcoin/chain', 'leofcoin/state'])
}

for (const event of ['uncaughtException', 'unhandledRejection']) {
  process.on(event, (error) => {
    emit('error', { message: error?.message || String(error), stack: error?.stack })
    process.exit(1)
  })
}

const { default: Node } = await import('../../packages/chain/exports/node.js')
const network = process.env.LEOFCOIN_E2E_NETWORK || 'leofcoin:e2e'
const networkVersion = process.env.LEOFCOIN_E2E_NETWORK_VERSION || 'e2e'
const node = new Node(
  {
    network,
    networkVersion,
    root: relative(homedir(), resolve(explicitRoot)),
    stars: process.env.LEOFCOIN_E2E_STAR ? [process.env.LEOFCOIN_E2E_STAR] : [],
    autoStart: false
  },
  process.env.LEOFCOIN_E2E_PASSWORD
)
await node.ready
for (const name of ['chain', 'state', 'accounts', 'wallet', 'account', 'contract', 'block', 'transaction', 'transactionPool']) {
  const store = globalThis[`${name}Store`]
  if (store && resolve(store.db?.root || '') !== resolve(explicitRoot))
    throw new Error(`E2E store escaped its explicit temporary root: ${name}`)
}

const discoveryEvents = []
globalThis.pubsub.subscribe('peer:joined', (peer) => {
  discoveryEvents.push(peer)
  emit('peer:joined', { peer })
})
globalThis.pubsub.subscribe('peer:connected', (peerId) => {
  emit('peer:connected', { peerId })
})

const { default: Chain } = await import('../../packages/chain/exports/chain.js')
// Explicitly trusted fixture checkpoint, only in the isolated temporary E2E network.
// Real identities and published genesis artifacts are never changed.
const { default: MultiWallet } = await import('@leofcoin/multi-wallet')
const fixtureMode = network === 'leofcoin:e2e' && process.env.LEOFCOIN_E2E_FIXTURE === '1'
const fixtureWallet = new MultiWallet(network)
await fixtureWallet.fromPrivateKey(Uint8Array.from({ length: 32 }, (_, index) => index + 1), undefined, network)
const fixtureProducer = await fixtureWallet.address
if (fixtureMode && !(await globalThis.chainStore.has('version'))) {
  const { default: fixtureAddresses } = await import('@leofcoin/addresses')
  const { default: definitions } = await import('@leofcoin/lib/bytecodes.json', { with: { type: 'json' } })
  const { ContractMessage } = await import('@leofcoin/messages')
  const { default: Machine } = await import('../../packages/chain/exports/machine.js')
  const { readCheckpoint, writeCheckpoint } = await import('../../packages/chain/exports/state-checkpoint.js')
  const { PROTOCOL_VERSION } = await import('../../packages/chain/exports/hash-format-state.js')
  const { createChainIdentity } = await import('@leofcoin/lib/chain-identity')
  const required = Object.values(fixtureAddresses)
  for (const value of Object.values(definitions)) {
    const message = new ContractMessage(Uint8Array.from(value.split(','), Number))
    await globalThis.contractStore.put(await message.hash(), message.encoded)
  }
  const machine = new Machine()
  await machine.ready
  await machine.updateState(true)
  const checkpoint = await readCheckpoint(globalThis.stateStore, (await createChainIdentity(network, fixtureAddresses)).chainId, required)
  const token = checkpoint.snapshot.states[fixtureAddresses.nativeToken]
  token.balances = { [fixtureProducer]: BigInt(token.totalSupply) }
  token.holders = 1n
  const validators = checkpoint.snapshot.states[fixtureAddresses.validators]
  validators.validators = [fixtureProducer]
  validators.currentValidator = fixtureProducer
  validators.validatorHistory = { 0: [fixtureProducer] }
  await writeCheckpoint(globalThis.stateStore, checkpoint.snapshot, 0, required)
  await globalThis.chainStore.put('version', PROTOCOL_VERSION)
  machine.close()
}
const chain = new Chain({ network, networkVersion })
await chain.ready

const { BlockMessage } = await import('@leofcoin/messages')
const { createContractMessage, signTransaction, calculateMonetaryPolicy } = await import('@leofcoin/lib')
const { default: addresses } = await import('@leofcoin/addresses')
const { readFile } = await import('node:fs/promises')
const { dirname, join } = await import('node:path')
const { fileURLToPath } = await import('node:url')
const { prepareGenesisContractSource } = await import('../../scripts/genesis-contract-source.js')
const { default: DexClient } = await import('../../packages/endpoint-clients/exports/dex.js')

const contractExports = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../packages/contracts/exports'
)

const storeText = async (store, key) => {
  if (!(await store.has(key))) return null
  return new TextDecoder().decode(await store.get(key))
}

const appendFixtureBlock = async () => {
  if (!fixtureMode) throw new Error('Synthetic fixture blocks are forbidden outside the isolated E2E network')
  const previous = await chain.lastBlock
  const index = Number(previous?.index ?? -1) + 1
  const producer = fixtureProducer
  const timestamp = Date.now()
  const policy = calculateMonetaryPolicy(BigInt(await chain.staticCall(addresses.nativeToken, 'totalSupply')), BigInt(await chain.staticCall(addresses.nativeToken, 'targetSupply')))
  const block = {
    index,
    previousHash: previous?.hash || '0x0',
    timestamp,
    reward: policy.subsidy,
    fees: 0n,
    transactions: [],
    validators: [{ address: producer, reward: policy.subsidy }],
    producer,
    producerProof: '',
    protocolVersion: chain.version
  }
  const unsignedBlockHash = await new BlockMessage(block).hash()
  const proof = await signTransaction(
    {
      from: producer,
      to: addresses.validators,
      method: 'produceBlock',
      params: [unsignedBlockHash],
      timestamp
    },
    fixtureWallet
  )
  const encoded = new BlockMessage({ ...block, producerProof: proof.signature }).encoded
  const message = new BlockMessage(encoded)
  const hash = await message.hash()

  await globalThis.peernet.put(hash, message.encoded, 'block')
  await chain.withCanonicalState(transition => chain.applyRecoveredBlock(message, transition))
  return { hash, index }
}

const deployBundle = async (filename, constructorParameters = []) => {
  const bundle = await readFile(join(contractExports, filename), 'utf8')
  const source = prepareGenesisContractSource(bundle)
  const message = await createContractMessage(
    globalThis.peernet.selectedAccount,
    new TextEncoder().encode(source),
    constructorParameters
  )
  const hash = await message.hash()
  await globalThis.contractStore.put(hash, message.encoded)
  await chain.machine.execute(
    addresses.contractFactory,
    'registerContract',
    [hash],
    globalThis.peernet.selectedAccount
  )
  await chain.machine.updateState(true)
  return hash
}

const deployDexFixture = async () => {
  if (!fixtureMode) throw new Error('Synthetic DEX state is forbidden outside the isolated E2E network')
  const account = globalThis.peernet.selectedAccount
  const unit = 10n ** 18n
  const registrationFee = BigInt(
    await chain.staticCall(addresses.contractFactory, 'tokenAmountToReceive')
  )
  const requiredLfc = 100_000n * unit
  const totalSupply = BigInt(await chain.staticCall(addresses.nativeToken, 'totalSupply'))
  const targetSupply = BigInt(await chain.staticCall(addresses.nativeToken, 'targetSupply'))
  if (targetSupply - totalSupply < requiredLfc)
    throw new Error('DEX fixture requires available test mint capacity')

  await chain.machine.settleRewards([[account, requiredLfc]])
  await chain.machine.execute(
    addresses.nativeToken,
    'approve',
    [addresses.contractFactory, registrationFee * 3n],
    account
  )

  const testToken = await deployBundle('mock-token.js', [
    'Leofcoin Test USD',
    'tUSD',
    18,
    1_000_000n * unit,
    []
  ])
  const factory = await deployBundle('liquidity-pool-factory.js')
  const pool = await deployBundle('liquidity-pool.js', [
    addresses.nativeToken,
    testToken,
    30n
  ])

  const dex = new DexClient(
    {
      staticCall: (contract, method, params = []) => chain.machine.get(contract, method, params)
    },
    factory
  )
  const executeDexTransaction = async (transaction) => {
    const value = await chain.machine.execute(transaction.to, transaction.method, transaction.params, transaction.from)
    // VM-only fixture mutations become a complete trusted checkpoint before isolated reads.
    await chain.machine.updateState(true)
    return value
  }
  const transactionOptions = { nonce: 1, timestamp: Date.now() }

  await executeDexTransaction(await dex.registerPool(account, pool, transactionOptions))
  const poolFor = await dex.poolFor(addresses.nativeToken, testToken)

  const { token0 } = await dex.poolState(pool)
  const amount0 = 10_000n * unit
  const amount1 = 20_000n * unit
  await executeDexTransaction(
    await dex.approve(account, addresses.nativeToken, pool, amount0, transactionOptions)
  )
  await executeDexTransaction(await dex.approve(account, testToken, pool, amount1, transactionOptions))
  await executeDexTransaction(
    await dex.addLiquidity(account, pool, amount0, amount1, 0n, transactionOptions)
  )

  const nativeAmountIn = 1_000n * unit
  const quoted = await dex.quoteExactInput(pool, addresses.nativeToken, nativeAmountIn)
  await executeDexTransaction(
    await dex.approve(account, addresses.nativeToken, pool, nativeAmountIn, transactionOptions)
  )
  const received = BigInt(
    await executeDexTransaction(
      await dex.swapExactInput(
        account,
        pool,
        addresses.nativeToken,
        nativeAmountIn,
        quoted,
        account,
        Number.MAX_SAFE_INTEGER,
        transactionOptions
      )
    )
  )
  const state = await dex.poolState(pool)
  const reserves = [state.reserve0, state.reserve1]

  return {
    account,
    factory,
    pool,
    poolFor,
    quoted,
    received,
    reserves,
    testToken,
    token0
  }
}

const status = async () => ({
  chainId: (await chain.getChainIdentity()).chainId,
  identity: globalThis.peernet.id,
  account: globalThis.peernet.selectedAccount,
  peers: globalThis.peernet.peers.length,
  connectedPeers: Object.values(globalThis.peernet.connections || {}).filter((peer) => peer.connected).length,
  clientStarted: Boolean(globalThis.peernet.client),
  supportedWebrtcBackend: globalThis.wrtc === await import('@vandeurenglenn/wrtc'),
  stars: globalThis.peernet.stars,
  discoveryEvents: discoveryEvents.length,
  discoverySubscribers: globalThis.pubsub.subscriberCount('peer:joined'),
  chain: chain.state,
  lastBlock: await chain.lastBlock,
  blockHashes: (await globalThis.blockStore.keys()).sort(),
  stateSnapshot: await storeText(globalThis.stateStore, 'lastBlock'),
  pendingTransactions: await globalThis.transactionPoolStore.keys()
})

emit('ready', await status())
process.stdin.setEncoding('utf8')
process.stdin.on('data', async (input) => {
  for (const command of input.trim().split(/\s+/)) {
    if (command === 'status') emit('status', await status())
    if (command === 'chain-identity') {
      const { decodeResponsePayload } = await import('../../packages/chain/src/helpers/response.ts')
      const { verifyChainIdentity } = await import('@leofcoin/lib/chain-identity')
      const request = new globalThis.peernet.protos['peernet-request']({ request: 'chainIdentity' })
      const message = await globalThis.peernet.prepareMessage(request)
      const connected = Object.values(globalThis.peernet.connections).filter(peer => peer.connected)
      const responses = await Promise.all(connected.map(async peer =>
        verifyChainIdentity(await decodeResponsePayload(await peer.request(message.encoded)))
      ))
      emit('chain:identity', { responses })
    }
    if (command === 'append-block') emit('block:produced', await appendFixtureBlock())
    if (command === 'queue-transaction') {
      const from = globalThis.peernet.selectedAccount
      const transaction = await signTransaction({
        from,
        to: addresses.nativeToken,
        method: 'transfer',
        params: [from, 1n],
        timestamp: Date.now(),
        nonce: (await chain.getNonce(from)) + 1
      }, globalThis.peernet.identity)
      const submitted = await chain.sendTransaction(transaction)
      submitted.wait.catch(error => emit('error', { message: error?.message || String(error) }))
      emit('transaction:queued', { hash: submitted.hash })
    }
    if (command === 'dex-fixture') emit('dex:deployed', await deployDexFixture())
    if (command === 'shutdown') {
      emit('stopped')
      process.exit(0)
    }
  }
})
