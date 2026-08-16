#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { parseCliOptions } from './cli-options.js'
import { startNode, type LocalNodeHandle } from './node.js'
import { startValidator } from './validator.js'

export const help = `Leofcoin command line

Usage:
  leofcoin node [options]                     Run a normal full node
  leofcoin validator [options]                Run a validator node
  leofcoin account [options]                  Show the local account
  leofcoin balance [address] [options]        Show an LFC balance
  leofcoin status [options]                   Show local chain status
  leofcoin transfer <address> <LFC> [options] Send LFC and await finalization

Options:
  --network <name>        Network (default: leofcoin:peach)
  --root <path>           Persistent data directory
  --password-file <path>  Read the identity password from a private file
  --star <url>            Discovery star; repeat for multiple stars
  --no-stars              Disable discovery stars
  --http-port <port>      HTTP API port (default: 8080)
  --ws-port <port>        WebSocket API port (default: 4040)
  --no-endpoints          Disable HTTP and WebSocket endpoints
  --no-shell              Disable the interactive wallet shell
  --interval <minutes>    Validator heartbeat interval (default: 5)
  -h, --help              Show help
  -v, --version           Show version

Passwords are never accepted as command-line values. Use --password-file,
LEOFCOIN_PASSWORD_FILE, LEOFCOIN_PASSWORD, or the interactive password prompt.
`

const packageVersion = async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  return manifest.version as string
}

const passwordFor = async (passwordFile?: string) => {
  const file = passwordFile ?? process.env.LEOFCOIN_PASSWORD_FILE
  if (!file) return process.env.LEOFCOIN_PASSWORD
  const password = (await readFile(resolve(file), 'utf8')).trim()
  if (!password) throw new Error(`empty identity password file: ${resolve(file)}`)
  return password
}

// @leofcoin/storage resolves its root below the home directory. Convert an
// absolute CLI path to the equivalent home-relative path before it reaches the
// storage layer, so `--root /var/lib/leofcoin` remains truly absolute.
const dataRootFor = (root?: string) => root && isAbsolute(root) ? relative(homedir(), root) : root

const amountFor = (chain: any, value?: string) => {
  if (!value) throw new Error('transfer amount is required')
  try {
    const amount = BigInt(chain.utils.parseUnits(value))
    if (amount <= 0n) throw new Error()
    return amount
  } catch {
    throw new Error('transfer amount must be a positive LFC amount')
  }
}

const showStatus = async (handle: LocalNodeHandle) => {
  const chain = handle.chain as any
  const lastBlock = await chain.lastBlock
  const balance = await chain.balanceOf(handle.account)
  process.stdout.write(`network: ${chain.network ?? 'leofcoin'}\n`)
  process.stdout.write(`account: ${handle.account}\n`)
  process.stdout.write(`balance: ${chain.utils.formatUnits(balance)} LFC\n`)
  process.stdout.write(`height: ${lastBlock?.index ?? 'unknown'}\n`)
  for (const url of handle.endpoints.http) process.stdout.write(`http: ${url}\n`)
  for (const url of handle.endpoints.ws) process.stdout.write(`ws: ${url}\n`)
}

const runShell = async (handle: LocalNodeHandle) => {
  const shell = createInterface({ input: process.stdin, output: process.stdout })
  const chain = handle.chain as any
  process.stdout.write('wallet shell ready; type help for commands\n')
  while (true) {
    const [command, ...values] = (await shell.question('leofcoin> ')).trim().split(/\s+/)
    try {
      if (!command) continue
      if (command === 'account') process.stdout.write(`${handle.account}\n`)
      else if (command === 'balance') {
        const balance = await chain.balanceOf(values[0] ?? handle.account)
        process.stdout.write(`${chain.utils.formatUnits(balance)} LFC\n`)
      } else if (command === 'status') await showStatus(handle)
      else if (command === 'transfer') {
        const hash = await handle.transfer(values[0], amountFor(chain, values[1]))
        process.stdout.write(`transfer finalized: ${hash}\n`)
      } else if (command === 'help') {
        process.stdout.write('account | balance [address] | status | transfer <address> <LFC> | exit\n')
      } else if (command === 'exit' || command === 'quit') {
        shell.close()
        break
      } else process.stderr.write(`unknown command: ${command}\n`)
    } catch (error) {
      process.stderr.write(`${(error as Error)?.message ?? error}\n`)
    }
  }
}

export const runCli = async (args = process.argv.slice(2)) => {
  const options = parseCliOptions(args)
  if (options.command === 'help') return void process.stdout.write(help)
  if (options.command === 'version') return void process.stdout.write(`${await packageVersion()}\n`)

  const common = {
    network: options.network ?? process.env.LEOFCOIN_NETWORK,
    root: dataRootFor(options.root ?? process.env.LEOFCOIN_DATA_ROOT),
    password: await passwordFor(options.passwordFile),
    stars: options.stars,
    httpPort: options.httpPort,
    wsPort: options.wsPort
  }
  const handle = options.command === 'validator'
    ? await startValidator({ ...common, intervalMinutes: options.intervalMinutes })
    : await startNode(common)
  const nodeHandle = handle as LocalNodeHandle
  const chain = nodeHandle.chain as any

  const shutdown = (signal: string) => {
    process.stdout.write(`received ${signal}; stopping node\n`)
    nodeHandle.stop()
    setTimeout(() => process.exit(0), 100)
  }
  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))

  if (options.command === 'account') process.stdout.write(`${nodeHandle.account}\n`)
  else if (options.command === 'balance') {
    const balance = await chain.balanceOf(options.positionals[0] ?? nodeHandle.account)
    process.stdout.write(`${chain.utils.formatUnits(balance)} LFC\n`)
  } else if (options.command === 'status') await showStatus(nodeHandle)
  else if (options.command === 'transfer') {
    const to = options.positionals[0]
    if (!to) throw new Error('transfer recipient is required')
    const hash = await nodeHandle.transfer(to, amountFor(chain, options.positionals[1]))
    process.stdout.write(`transfer finalized: ${hash}\n`)
  } else {
    process.stdout.write(`${options.command} account: ${nodeHandle.account}\n`)
    if (options.shell && process.stdin.isTTY) await runShell(nodeHandle)
    else return
  }

  nodeHandle.stop()
  // Peernet and endpoint servers currently expose no shared async close API.
  // Give pending output a moment to flush, then make one-shot commands and an
  // explicitly closed interactive shell terminate predictably.
  setTimeout(() => process.exit(0), 100)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    process.stderr.write(`leofcoin: ${(error as Error)?.message ?? error}\n`)
    process.exitCode = 1
  })
}
