#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { startValidator } from './validator.js'

const args = process.argv.slice(2)
const valueAfter = (name: string) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`Usage:
  leofcoin-validator [options]
  leofcoin transfer <address> <amount-LFC> [options]

Options:
  --network <name>           Network (default: leofcoin:peach)
  --root <path>              Persistent Leofcoin data directory
  --password-file <path>     Read the identity password from a private file
  --interval <minutes>       Heartbeat interval (default: 5, minimum: 1)
  --http-port <port>         HTTP API port (default: 8080)
  --ws-port <port>           WebSocket API port (default: 4040)
  --no-endpoints             Disable both API endpoints
  --no-shell                 Disable the interactive local wallet shell
  -h, --help                 Show this help

Without --password-file, LEOFCOIN_PASSWORD is used when set. Otherwise the
standard interactive password prompt is shown. Never pass a password directly
as a command-line argument. The interactive shell supports: account, balance,
transfer <address> <amount-LFC>, help, and exit.
`)
  process.exit(0)
}

const passwordFile = valueAfter('--password-file') ?? process.env.LEOFCOIN_PASSWORD_FILE
const password = passwordFile
  ? (await readFile(resolve(passwordFile), 'utf8')).trim()
  : process.env.LEOFCOIN_PASSWORD
if (passwordFile && !password) throw new Error(`empty validator password file: ${resolve(passwordFile)}`)

const intervalValue = valueAfter('--interval') ?? process.env.LEOFCOIN_TRANSACTION_INTERVAL_MINUTES
const noEndpoints = args.includes('--no-endpoints')
const command = args[0]?.startsWith('-') ? undefined : args[0]
if (command && command !== 'transfer') throw new Error(`unknown command: ${command}`)
const port = (name: string, fallback: number) => {
  const value = Number(valueAfter(name) ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) throw new Error(`${name} must be a valid port`)
  return value
}
const handle = await startValidator({
  network: valueAfter('--network') ?? process.env.LEOFCOIN_NETWORK,
  root: valueAfter('--root') ?? process.env.LEOFCOIN_DATA_ROOT,
  password,
  intervalMinutes: intervalValue === undefined ? undefined : Number(intervalValue),
  httpPort: noEndpoints ? false : port('--http-port', 8080),
  wsPort: noEndpoints ? false : port('--ws-port', 4040),
  heartbeat: command !== 'transfer'
})

const shutdown = (signal: string) => {
  process.stdout.write(`received ${signal}; stopping validator\n`)
  handle.stop()
  setTimeout(() => process.exit(0), 100)
}
process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

const chainRuntime = handle.chain as any
const parseAmount = (value: string | undefined) => {
  if (!value) throw new Error('transfer amount is required')
  return BigInt(chainRuntime.utils.parseUnits(value))
}
const transfer = async (to: string | undefined, amount: string | undefined) => {
  if (!to) throw new Error('transfer recipient is required')
  const hash = await handle.transfer(to, parseAmount(amount))
  process.stdout.write(`transfer finalized: ${hash}\n`)
}

if (command === 'transfer') {
  await transfer(args[1], args[2])
  handle.stop()
  setTimeout(() => process.exit(0), 100)
} else if (process.stdin.isTTY && !args.includes('--no-shell')) {
  const shell = createInterface({ input: process.stdin, output: process.stdout })
  process.stdout.write('local wallet ready; type help for commands\n')
  while (true) {
    const [shellCommand, ...values] = (await shell.question('leofcoin> ')).trim().split(/\s+/)
    try {
      if (!shellCommand) continue
      if (shellCommand === 'account') process.stdout.write(`${handle.account}\n`)
      else if (shellCommand === 'balance') {
        const balance = await chainRuntime.balanceOf(handle.account)
        process.stdout.write(`${chainRuntime.utils.formatUnits(balance)} LFC\n`)
      } else if (shellCommand === 'transfer') await transfer(values[0], values[1])
      else if (shellCommand === 'help') {
        process.stdout.write('account | balance | transfer <address> <amount-LFC> | exit\n')
      } else if (shellCommand === 'exit' || shellCommand === 'quit') {
        shell.close()
        shutdown('shell exit')
        break
      } else process.stderr.write(`unknown command: ${shellCommand}\n`)
    } catch (error) {
      process.stderr.write(`${(error as Error)?.message ?? error}\n`)
    }
  }
}
