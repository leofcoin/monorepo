import addresses from '@leofcoin/addresses'
import Chain from '@leofcoin/chain/chain'
import { signTransaction } from '@leofcoin/lib'
import networks from '@leofcoin/networks'
import launch from './index.js'

export type ValidatorOptions = {
  network?: string
  networkVersion?: string
  stars?: string[]
  root?: string
  password?: string
  intervalMinutes?: number
  registrationTimeoutMs?: number
  httpPort?: number | false
  wsPort?: number | false
  heartbeat?: boolean
  signal?: AbortSignal
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

export type ValidatorHandle = {
  account: string
  chain: Chain
  transfer: (to: string, amount: bigint) => Promise<string>
  stop: () => void
}

const delay = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('validator stopped'))
    const onAbort = () => {
      clearTimeout(timeout)
      reject(signal?.reason ?? new Error('validator stopped'))
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', onAbort, { once: true })
  })

export const validateIntervalMinutes = (value: number): number => {
  if (!Number.isFinite(value) || value < 1) throw new Error('validator interval must be at least one minute')
  return value
}

export const startValidator = async (options: ValidatorOptions = {}): Promise<ValidatorHandle> => {
  const network = options.network ?? 'leofcoin:peach'
  const networkVersion = options.networkVersion ?? network.split(':')[1] ?? 'peach'
  const stars = options.stars ?? networks.leofcoin.peach.stars
  const intervalMinutes = validateIntervalMinutes(options.intervalMinutes ?? 5)
  const registrationTimeoutMs = options.registrationTimeoutMs ?? 5 * 60_000
  const logger = options.logger ?? console
  const controller = new AbortController()
  options.signal?.addEventListener('abort', () => controller.abort(options.signal?.reason), { once: true })

  const launched = await launch(
    {
      mode: 'direct',
      network,
      networkVersion,
      stars,
      root: options.root,
      http: options.httpPort === false ? [] : [{ port: options.httpPort ?? 8080 }],
      ws: options.wsPort === false ? [] : [{ port: options.wsPort ?? 4040 }]
    },
    options.password
  )
  if (!launched.chain) throw new Error('validator launch did not create a direct chain runtime')
  const chain = launched.chain
  const chainRuntime = chain as any
  const peernet = (globalThis as any).peernet

  const account = peernet?.selectedAccount
  if (!account) throw new Error('validator identity has no selected account')
  logger.log(`validator account: ${account}`)

  const isRegistered = () => chainRuntime.staticCall(addresses.validators, 'has', [account])
  if (!(await isRegistered())) {
    const [balanceValue, minimumValue] = await Promise.all([
      chainRuntime.balanceOf(account),
      chainRuntime.staticCall(addresses.validators, 'minimumBalance')
    ])
    const balance = BigInt(balanceValue)
    const minimumBalance = BigInt(minimumValue)
    if (balance < minimumBalance) {
      throw new Error(
        `validator account ${account} has balance ${balance}; registration requires at least ${minimumBalance}`
      )
    }

    const submitted = await chainRuntime.participate(account)
    if (submitted) throw new Error('validator registration state changed unexpectedly')
    logger.log('validator registration submitted; waiting for finalization...')
    const deadline = Date.now() + registrationTimeoutMs
    while (Date.now() < deadline && !(await isRegistered())) await delay(5_000, controller.signal)
    if (!(await isRegistered())) {
      throw new Error(
        'validator registration was not finalized; at least one existing validator must be online to produce it'
      )
    }
  }

  if (!(await chainRuntime.participate(account))) {
    throw new Error('validator is registered but participation did not activate')
  }
  logger.log('validator participation active')

  const transfer = async (to: string, amount: bigint): Promise<string> => {
    if (typeof to !== 'string' || to.length === 0) throw new Error('transfer recipient is required')
    if (amount <= 0n) throw new Error('transfer amount must be greater than zero')
    const balance = BigInt(await chainRuntime.balanceOf(account))
    if (balance < amount) throw new Error(`insufficient balance: have ${balance}, need at least ${amount}`)
    const raw = await chainRuntime.createTransaction({
      from: account,
      to: chain.nativeToken,
      method: 'transfer',
      params: [to, amount]
    })
    const signed = await signTransaction(raw, peernet.identity)
    const pending = await chainRuntime.sendTransaction(signed)
    return pending.wait
  }

  let sending = false
  const heartbeat = async () => {
    if (controller.signal.aborted || sending) return
    sending = true
    try {
      const balance = BigInt(await chainRuntime.balanceOf(account))
      if (balance <= 1n) {
        logger.warn(`heartbeat skipped: balance ${balance} is too low`)
        return
      }
      const hash = await transfer(account, 1n)
      logger.log(`heartbeat transaction finalized: ${hash}`)
    } catch (error) {
      logger.error(`heartbeat transaction failed: ${(error as Error)?.message ?? error}`)
    } finally {
      sending = false
    }
  }

  // Startup must not wait for a transaction to finalize. In particular, the
  // interactive wallet shell and API endpoints must remain available while a
  // single-node validator is still trying to produce/finalize its heartbeat.
  if (options.heartbeat !== false) void heartbeat()
  const interval = options.heartbeat === false ? undefined : setInterval(heartbeat, intervalMinutes * 60_000)
  const stop = () => {
    if (controller.signal.aborted) return
    controller.abort(new Error('validator stopped'))
    if (interval) clearInterval(interval)
  }
  controller.signal.addEventListener('abort', () => interval && clearInterval(interval), { once: true })

  return { account, chain, transfer, stop }
}
