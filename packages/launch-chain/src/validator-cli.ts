#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { startValidator } from './validator.js'

const args = process.argv.slice(2)
const valueAfter = (name: string) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`Usage: leofcoin-validator [options]

Options:
  --network <name>           Network (default: leofcoin:peach)
  --root <path>              Persistent Leofcoin data directory
  --password-file <path>     Read the identity password from a private file
  --interval <minutes>       Heartbeat interval (default: 5, minimum: 1)
  --http-port <port>         HTTP API port (default: 8080)
  --ws-port <port>           WebSocket API port (default: 4040)
  --no-endpoints             Disable both API endpoints
  -h, --help                 Show this help

Without --password-file, LEOFCOIN_PASSWORD is used when set. Otherwise the
standard interactive password prompt is shown. Never pass a password directly
as a command-line argument.
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
const port = (name: string, fallback: number) => {
  const value = Number(valueAfter(name) ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) throw new Error(`${name} must be a valid port`)
  return value
}
const controller = new AbortController()
const handle = await startValidator({
  network: valueAfter('--network') ?? process.env.LEOFCOIN_NETWORK,
  root: valueAfter('--root') ?? process.env.LEOFCOIN_DATA_ROOT,
  password,
  intervalMinutes: intervalValue === undefined ? undefined : Number(intervalValue),
  httpPort: noEndpoints ? false : port('--http-port', 8080),
  wsPort: noEndpoints ? false : port('--ws-port', 4040),
  signal: controller.signal
})

const shutdown = (signal: string) => {
  process.stdout.write(`received ${signal}; stopping validator\n`)
  handle.stop()
  setTimeout(() => process.exit(0), 100)
}
process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
