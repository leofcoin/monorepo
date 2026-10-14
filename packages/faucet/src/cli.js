#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { unlinkSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { resolve, join, relative } from 'node:path'
import { homedir } from 'node:os'
import MultiWallet from '@leofcoin/multi-wallet'
import { parseUnits } from '@leofcoin/utils'
import { signTransaction, calculateFee } from '@leofcoin/lib'
import { startNode } from '@leofcoin/launch-chain/node'
import { Faucet, FaucetError } from './service.js'
import { faucetServer } from './server.js'

const network = process.env.FAUCET_NETWORK || 'leofcoin:peach'
if (network !== 'leofcoin:peach') throw new Error('The faucet is restricted to the Peach testnet.')
const directory = resolve(process.env.FAUCET_DATA_DIR || join(homedir(), '.leofcoin', 'peach-faucet'))
await mkdir(directory, { recursive: true, mode: 0o700 })
const lockPath = join(directory, 'faucet.lock')
try {
  await writeFile(lockPath, JSON.stringify({ pid: process.pid }), { mode: 0o600, flag: 'wx' })
} catch (error) {
  if (error.code === 'EEXIST')
    throw new Error(
      `Faucet directory is locked: ${lockPath}. Stop the existing process before starting another. After an unclean shutdown, verify no faucet process is running before removing this lock.`
    )
  throw error
}
process.once('exit', () => {
  try {
    unlinkSync(lockPath)
  } catch {}
})
const passwordPath = join(directory, 'password.txt')
try {
  await writeFile(passwordPath, randomBytes(32).toString('base64url'), { mode: 0o600, flag: 'wx' })
} catch (error) {
  if (error.code !== 'EEXIST') throw error
}
const password = (await readFile(passwordPath, 'utf8')).trim()
if (!password) throw new Error('Faucet password file is empty')
globalThis.wrtc = await import('@vandeurenglenn/wrtc')
const node = await startNode({
  network,
  networkVersion: 'peach',
  root: relative(homedir(), join(directory, 'node')),
  password,
  httpPort: false,
  wsPort: false
})
const accountPath = join(directory, 'account.json')
try {
  const previous = JSON.parse(await readFile(accountPath, 'utf8'))
  if (previous.address !== node.account)
    throw new Error('Faucet identity changed. Refusing startup; restore the original identity.')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  await writeFile(accountPath, JSON.stringify({ network, address: node.account }), { mode: 0o600, flag: 'wx' })
}
const backupPath = join(directory, 'identity.backup')
try {
  await writeFile(backupPath, await globalThis.peernet.identity.export(password), { mode: 0o600, flag: 'wx' })
} catch (error) {
  if (error.code !== 'EEXIST') throw error
}
const amount = parseUnits(process.env.FAUCET_AMOUNT || '10')
const dailyBudget = parseUnits(process.env.FAUCET_DAILY_BUDGET || '1000')
const faucet = await new Faucet({
  ledger: join(directory, 'claims.json'),
  amount,
  dailyBudget,
  adapter: {
    validateAddress: async (address) => {
      try {
        await new MultiWallet(network).fromAddress(address, null, network)
      } catch {
        throw new FaucetError(400, 'Invalid Peach recipient address')
      }
      if (address === node.account) throw new FaucetError(400, 'Cannot claim to the faucet account')
    },
    health: async () => {
      const balance = BigInt((await node.chain.balanceOf(node.account)) || 0n)
      const connected = Object.values(globalThis.peernet.connections || {}).some((peer) => peer.connected)
      return {
        account: node.account,
        balance,
        ready: connected && node.chain.state.sync === 'synced' && balance > amount
      }
    },
    quote: async (to, amount) => {
      const raw = await node.chain.createTransaction({
        from: node.account,
        to: node.chain.nativeToken,
        method: 'transfer',
        params: [to, amount.toString()]
      })
      const signed = await signTransaction(raw, globalThis.peernet.identity)
      const fee = BigInt(await calculateFee(signed))
      if (BigInt((await node.chain.balanceOf(node.account)) || 0n) < amount + fee)
        throw new Error('Faucet balance cannot cover amount and fee')
      return { signed, fee }
    },
    submit: async (_to, _amount, quote) => node.chain.sendTransaction(quote.signed),
    reportError: (error) => console.error('Faucet claim needs operator attention:', error.message)
  }
}).init()
const origins = (process.env.FAUCET_ORIGINS || 'https://leofcoin.org,https://leofcoin.github.io')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const port = Number(process.env.FAUCET_PORT || 8088)
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid faucet port')
const server = faucetServer(faucet, { origins, trustProxy: process.env.FAUCET_TRUST_PROXY === '1' })
server.listen(port, '127.0.0.1', () => {
  console.log(`Peach faucet account: ${node.account}`)
  console.log(
    `Password file: ${passwordPath}; encrypted identity backup: ${backupPath}. Back up the complete ${directory} directory securely.`
  )
  console.log(`Faucet listening on 127.0.0.1:${port}; fund this account from the testnet owner before enabling claims.`)
})
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, async () => {
    server.close()
    await faucet.flush()
    node.stop()
    process.exit(0)
  })
