import Chain from '@leofcoin/chain/chain'
import { signTransaction } from '@leofcoin/lib'
import networks from '@leofcoin/networks'
import launch from './index.js'

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

  const transfer = async (to: string, amount: bigint): Promise<string> => {
    if (!to) throw new Error('transfer recipient is required')
    if (amount <= 0n) throw new Error('transfer amount must be greater than zero')
    const balance = BigInt(await chainRuntime.balanceOf(account))
    if (balance < amount) throw new Error(`insufficient balance: have ${balance}, need at least ${amount}`)
    const raw = await chainRuntime.createTransaction({
      from: account, to: chain.nativeToken, method: 'transfer', params: [to, amount]
    })
    const signed = await signTransaction(raw, peernet.identity)
    const pending = await chainRuntime.sendTransaction(signed)
    return pending.wait
  }

  return {
    account,
    chain,
    endpoints: launched.endpoints,
    transfer,
    stop: () => controller.abort(new Error('node stopped'))
  }
}
