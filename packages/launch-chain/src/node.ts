import Chain from '@leofcoin/chain/chain'
import { signTransaction } from '@leofcoin/lib'
import networks from '@leofcoin/networks'
import launch from './index.js'
import { interactiveBatch, type BatchInteraction } from './batch.js'

export type LocalNodeOptions = {
  network?: string
  networkVersion?: string
  stars?: string[]
  root?: string
  password?: string
  httpPort?: number | false
  wsPort?: number | false
  signal?: AbortSignal
}

export type LocalNodeHandle = {
  account: string
  chain: Chain
  endpoints: { http: string[]; ws: string[] }
  transfer: (to: string, amount: bigint) => Promise<string>
  batch: (interaction: BatchInteraction) => Promise<void>
  walletBusy: boolean
  stop: () => void
}

export const startNode = async (options: LocalNodeOptions = {}): Promise<LocalNodeHandle> => {
  const network = options.network ?? 'leofcoin:peach'
  const networkVersion = options.networkVersion ?? network.split(':')[1] ?? 'peach'
  const stars = options.stars ?? networks.leofcoin.peach.stars
  const controller = new AbortController()
  options.signal?.addEventListener('abort', () => controller.abort(options.signal?.reason), { once: true })

  const launched = await launch(
    {
      mode: 'direct', network, networkVersion, stars, root: options.root,
      http: options.httpPort === false ? [] : [{ port: options.httpPort ?? 8080 }],
      ws: options.wsPort === false ? [] : [{ port: options.wsPort ?? 4040 }]
    },
    options.password
  )
  if (!launched.chain) throw new Error('node launch did not create a direct chain runtime')

  const chain = launched.chain
  const chainRuntime = chain as any
  const peernet = (globalThis as any).peernet
  const account = peernet?.selectedAccount
  if (!account) throw new Error('node identity has no selected account')
  let batchActive = false
  let activeTransfers = 0

  const transfer = async (to: string, amount: bigint): Promise<string> => {
    if (batchActive) throw new Error('Wallet is reserved for an interactive batch')
    if (!to) throw new Error('transfer recipient is required')
    if (amount <= 0n) throw new Error('transfer amount must be greater than zero')
    activeTransfers++
    try {
      const balance = BigInt(await chainRuntime.balanceOf(account))
      if (balance < amount) throw new Error(`insufficient balance: have ${balance}, need at least ${amount}`)
      const raw = await chainRuntime.createTransaction({
        from: account, to: chain.nativeToken, method: 'transfer', params: [to, amount]
      })
      const signed = await signTransaction(raw, peernet.identity)
      const pending = await chainRuntime.sendTransaction(signed)
      return await pending.wait
    } finally { activeTransfers-- }
  }

  return {
    account,
    chain,
    endpoints: launched.endpoints,
    transfer,
    get walletBusy() { return batchActive },
    batch: async interaction => {
      if (batchActive) throw new Error('A wallet batch is already active')
      if (activeTransfers) throw new Error('Wait for the active wallet transfer to finish before starting a batch')
      batchActive = true
      try {
        await interactiveBatch({
          account,
          identity: () => chainRuntime.getChainIdentity(),
          connected: () => peernet.selectedAccount === account && chainRuntime.state?.sync === 'synced' &&
            Object.values(peernet.connections || {}).some(peer =>
              !!peer && typeof peer === 'object' && 'connected' in peer && peer.connected === true),
          balance: async () => BigInt(await chainRuntime.balanceOf(account)),
          nonce: () => chainRuntime.getNonce(account),
          parseAmount: value => BigInt(chainRuntime.utils.parseUnits(value)),
          formatAmount: value => String(chainRuntime.utils.formatUnits(value)),
          sign: (nonce, to, amount) => {
            const raw = { from: account, to: chain.nativeToken, method: 'transfer',
              params: [to, amount], timestamp: Date.now(), nonce }
            return signTransaction(raw, peernet.identity)
          },
          submit: transaction => chainRuntime.sendTransaction(transaction)
        }, interaction)
      } finally { batchActive = false }
    },
    stop: () => controller.abort(new Error('node stopped'))
  }
}
