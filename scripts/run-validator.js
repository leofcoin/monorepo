import { signTransaction } from '@leofcoin/lib'
import networks from '@leofcoin/networks'
import addresses from '@leofcoin/addresses'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const passwordPath = resolve(
  process.env.LEOFCOIN_PASSWORD_FILE || 'genesis-credentials/leofcoin-peach/genesis-password.txt'
)
const intervalMinutes = Number(process.env.LEOFCOIN_TRANSACTION_INTERVAL_MINUTES || 5)
if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1) {
  throw new Error('LEOFCOIN_TRANSACTION_INTERVAL_MINUTES must be at least 1')
}

const password = (await readFile(passwordPath, 'utf8')).trim()
if (!password) throw new Error(`empty validator password file: ${passwordPath}`)

const { default: Node } = await import('../packages/chain/exports/node.js')
const node = new Node(
  {
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'peach',
    stars: networks.leofcoin.peach.stars,
    autoStart: false
  },
  password
)
await node.ready

const { default: Chain } = await import('../packages/chain/exports/chain.js')
const chain = new Chain({ network: 'leofcoin:peach', networkVersion: 'peach' })
await chain.ready

const account = globalThis.peernet.selectedAccount
if (!account) throw new Error('validator identity has no selected account')
process.stdout.write(`validator account: ${account}\n`)

const waitForValidatorRegistration = async (timeoutMs = 5 * 60_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await chain.staticCall(addresses.validators, 'has', [account])) return
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000))
  }
  throw new Error('validator registration was not finalized within five minutes')
}

let participating = await chain.participate(account)
if (!participating) {
  process.stdout.write('validator registration submitted; waiting for finalization...\n')
  await waitForValidatorRegistration()
  participating = await chain.participate(account)
}
if (!participating) throw new Error('validator registration finalized but participation did not activate')
process.stdout.write('validator participation active\n')

let stopping = false
let sending = false
const sendHeartbeatTransaction = async () => {
  if (stopping || sending) return
  sending = true
  try {
    const balance = BigInt(await chain.balanceOf(account))
    if (balance <= 1n) {
      process.stdout.write(`heartbeat skipped: balance ${balance} is too low\n`)
      return
    }
    const raw = await chain.createTransaction({
      from: account,
      to: chain.nativeToken,
      method: 'transfer',
      params: [account, account, 1n]
    })
    const signed = await signTransaction(raw, globalThis.peernet.identity)
    const pending = await chain.sendTransaction(signed)
    const hash = await pending.wait
    process.stdout.write(`heartbeat transaction finalized: ${hash}\n`)
  } catch (error) {
    process.stderr.write(`heartbeat transaction failed: ${error?.message || error}\n`)
  } finally {
    sending = false
  }
}

await sendHeartbeatTransaction()
const interval = setInterval(sendHeartbeatTransaction, intervalMinutes * 60_000)

const shutdown = async (signal) => {
  if (stopping) return
  stopping = true
  clearInterval(interval)
  process.stdout.write(`received ${signal}; stopping validator\n`)
  setTimeout(() => process.exit(0), 100)
}
process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
