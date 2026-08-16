const stringify = (value) => JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item))
const emit = (type, value = {}) => process.stdout.write(`E2E_EVENT:${stringify({ type, ...value })}\n`)

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
    root: process.env.LEOFCOIN_E2E_ROOT || '.leofcoin/e2e',
    stars: process.env.LEOFCOIN_E2E_STAR ? [process.env.LEOFCOIN_E2E_STAR] : [],
    autoStart: false
  },
  process.env.LEOFCOIN_E2E_PASSWORD
)
await node.ready

const discoveryEvents = []
globalThis.pubsub.subscribe('peer:joined', (peer) => {
  discoveryEvents.push(peer)
  emit('peer:joined', { peer })
})
globalThis.pubsub.subscribe('peer:connected', (peerId) => {
  emit('peer:connected', { peerId })
})

const { default: Chain } = await import('../../packages/chain/exports/chain.js')
const chain = new Chain({ network, networkVersion })
await chain.ready

const { BlockMessage } = await import('@leofcoin/messages')
const { createContractMessage, signTransaction } = await import('@leofcoin/lib')
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
  const previous = await chain.lastBlock
  const index = Number(previous?.index ?? -1) + 1
  const producer = globalThis.peernet.selectedAccount
  const timestamp = Date.now()
  const block = {
    index,
    previousHash: previous?.hash || '0x0',
    timestamp,
    reward: 150n,
    fees: 0n,
    transactions: [],
    validators: [{ address: producer, reward: 150n }],
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
    globalThis.peernet.identity
  )
  const encoded = new BlockMessage({ ...block, producerProof: proof.signature }).encoded
  const message = new BlockMessage(encoded)
  const hash = await message.hash()

  await globalThis.peernet.put(hash, message.encoded, 'block')
  await chain.machine.addLoadedBlock({ ...message.decoded, hash, loaded: true })
  await chain.updateState(message)
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
  return hash
}

const deployDexFixture = async () => {
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
  const executeDexTransaction = async (transaction) =>
    chain.machine.execute(
      transaction.to,
      transaction.method,
      transaction.params,
      transaction.from
    )
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
  identity: globalThis.peernet.id,
  account: globalThis.peernet.selectedAccount,
  peers: globalThis.peernet.peers.length,
  connectedPeers: Object.values(globalThis.peernet.connections || {}).filter((peer) => peer.connected).length,
  clientStarted: Boolean(globalThis.peernet.client),
  stars: globalThis.peernet.stars,
  discoveryEvents: discoveryEvents.length,
  discoverySubscribers: globalThis.pubsub.subscriberCount('peer:joined'),
  chain: chain.state,
  lastBlock: await chain.lastBlock,
  blockHashes: (await globalThis.blockStore.keys()).sort(),
  stateSnapshot: await storeText(globalThis.stateStore, 'lastBlock')
})

emit('ready', await status())
process.stdin.setEncoding('utf8')
process.stdin.on('data', async (input) => {
  for (const command of input.trim().split(/\s+/)) {
    if (command === 'status') emit('status', await status())
    if (command === 'append-block') emit('block:produced', await appendFixtureBlock())
    if (command === 'dex-fixture') emit('dex:deployed', await deployDexFixture())
    if (command === 'shutdown') {
      emit('stopped')
      process.exit(0)
    }
  }
})
