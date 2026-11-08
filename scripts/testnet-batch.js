import { open, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import Client from '@leofcoin/endpoint-clients/http'
import MultiWallet from '@leofcoin/multi-wallet'
import { TransactionMessage } from '@leofcoin/messages'
import { calculateFee, signTransaction } from '@leofcoin/lib'
import addresses from '@leofcoin/addresses'
import { createChainIdentity, verifyChainIdentity } from '@leofcoin/lib/chain-identity'

export const help = `Submit a deliberate Peach testnet transaction burst (never mainnet).

  npm run testnet:batch                         Interactive wizard, existing local wallet
  npm run testnet:batch -- --interactive --root <existing-node-root>
  npm run testnet:batch -- --endpoint http://127.0.0.1:8080 --from <address> --to <address> --count 100000
  npm run testnet:batch -- --endpoint http://127.0.0.1:8080 --from <address> --to <address> --count 100000 --amount 1 --concurrency 32 --wallet-file <encrypted-export> --password-file <file> --output <new-receipts.jsonl> --confirm-testnet-send

Default: read-only preview. Amount is positive integer atoms per transfer.
Count: any positive safe integer; concurrency: 1..1024 (default 32).
All transfers are signed before submission and queued without waiting for blocks.
Concurrency limits in-flight HTTP requests, not the total pending transaction pool.
The endpoint must support /submitTransaction (admission, NOT finalization).
Use a dedicated funded TEST wallet; no other sender/heartbeat may use its nonces.
Wallet file: encrypted string from MultiWallet.export(password), never a raw key.
No credentials are sent to the endpoint. Output is an exclusive new JSONL journal.
Failures halt new requests; in-flight requests are drained. Timeouts are UNKNOWN,
not proof of rejection. Do not blindly rerun: reconcile hashes and pending nonces.
Only run against a testnet endpoint/network you own or have permission to load.
If your node is already running, type batch in its wallet shell instead of
starting another process against the same stores.
`

const integer = (value, name, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!/^[1-9]\d*$/.test(String(value))) throw new Error(`${name} must be a positive integer`)
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number > maximum) throw new Error(`${name} exceeds ${maximum}`)
  return number
}
const decimal = (value, name) => {
  if (!/^(0|[1-9]\d*)$/.test(String(value))) throw new Error(`${name} must be an exact nonnegative integer`)
  return BigInt(value)
}

export function parseBatchOptions(args) {
  const options = { count: 100000, amount: 1n, concurrency: 32, confirm: false }
  const flags = new Map([
    ['--endpoint', 'endpoint'], ['--from', 'from'], ['--to', 'to'], ['--count', 'count'],
    ['--amount', 'amount'], ['--concurrency', 'concurrency'], ['--wallet-file', 'walletFile'],
    ['--password-file', 'passwordFile'], ['--output', 'output']
  ])
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    if (flag === '--help' || flag === '-h') options.help = true
    else if (flag === '--confirm-testnet-send') options.confirm = true
    else {
      const key = flags.get(flag)
      if (!key) throw new Error(`Unknown option: ${flag}`)
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
      options[key] = value
    }
  }
  if (options.help) return options
  options.count = integer(options.count, 'count')
  options.concurrency = integer(options.concurrency, 'concurrency', 1024)
  options.amount = decimal(options.amount, 'amount')
  if (!options.amount) throw new Error('amount must be greater than zero')
  if (!options.from || !options.to) throw new Error('--from and --to are required')
  const url = new URL(options.endpoint)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('endpoint must be an HTTP(S) URL without credentials, query or fragment')
  options.endpoint = url.href.replace(/\/$/, '')
  if (options.confirm && (!options.walletFile || !options.passwordFile || !options.output))
    throw new Error('Sending requires --wallet-file, --password-file and --output')
  return options
}

export async function loadBatchSigner(options) {
  const [encrypted, password] = await Promise.all([
    readFile(options.walletFile, 'utf8'), readFile(options.passwordFile, 'utf8')
  ])
  if (!encrypted.trim() || !password.trim()) throw new Error('Encrypted wallet and password files must not be empty')
  const wallet = new MultiWallet('leofcoin:peach')
  await wallet.import(password.trim(), encrypted.trim())
  if (await wallet.address !== options.from) throw new Error('Encrypted signing wallet does not match --from')
  return wallet
}

export async function runBatch(options, {
  client = new Client(options.endpoint, 'peach'),
  loadSigner = loadBatchSigner,
  sign = signTransaction,
  fee = calculateFee,
  message = value => new TransactionMessage(value),
  journal,
  signal,
  log = console.log
} = {}) {
  const identity = await verifyChainIdentity(await client._fetch('chainIdentity'))
  const expected = await createChainIdentity('leofcoin:peach', addresses)
  if (identity.network !== 'leofcoin:peach' || identity.chainId !== expected.chainId)
    throw new Error('Endpoint is not the expected Peach testnet chain')
  const status = await client._fetch('manager/rpc', { action: 'status', chainId: identity.chainId, account: options.from })
  if (status.chainId !== identity.chainId || !status.synced || status.peers < 1)
    throw new Error('Endpoint must be synced and connected; do not send to an offline producer')
  const nonce = decimal(await client._fetch('getNonce', { address: options.from }), 'endpoint nonce')
  if (nonce + BigInt(options.count) > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Nonce range exceeds the signing API safe integer limit')
  const balance = decimal(await client.staticCall(addresses.nativeToken, 'balanceOf', [options.from]), 'balance')
  const plan = { network: identity.network, chainId: identity.chainId, endpoint: options.endpoint,
    from: options.from, to: options.to, count: options.count, amountAtoms: String(options.amount),
    totalTransferAtoms: String(options.amount * BigInt(options.count)), balanceAtoms: String(balance),
    firstNonce: String(nonce + 1n), lastNonce: String(nonce + BigInt(options.count)), concurrency: options.concurrency }
  log(JSON.stringify({ status: 'preview', ...plan, notice: 'Fees are computed from all signed transactions before sending. Admission is not finalization.' }))
  if (!options.confirm) return { status: 'preview', ...plan }
  if (!journal) throw new Error('Sending requires a durable receipt journal')
  const signer = await loadSigner(options)
  const transactions = []
  let fees = 0n
  for (let index = 0; index < options.count; index++) {
    signal?.throwIfAborted()
    const signed = await sign({ from: options.from, to: addresses.nativeToken, method: 'transfer',
      params: [options.to, options.amount], timestamp: Date.now(), nonce: Number(nonce) + index + 1 }, signer)
    const transaction = message(signed)
    fees += decimal(await fee(transaction.decoded), 'transaction fee')
    transactions.push({ signed, hash: await transaction.hash(), nonce: Number(nonce) + index + 1 })
    if ((index + 1) % 1000 === 0) log(`signed ${index + 1}/${options.count}`)
  }
  const required = options.amount * BigInt(options.count) + fees
  if (balance < required) throw new Error(`Insufficient balance: have ${balance}, need ${required} atoms including ${fees} fees`)
  const currentNonce = decimal(await client._fetch('getNonce', { address: options.from }), 'endpoint nonce')
  if (currentNonce !== nonce) throw new Error('Sender nonce changed during signing; no transactions sent. Use a dedicated idle wallet')
  await journal({ status: 'prepared', ...plan, feeAtoms: String(fees), requiredAtoms: String(required) })
  let next = 0
  let attempted = 0
  let admitted = 0
  let failure
  const worker = async () => {
    while (!failure && !signal?.aborted && next < transactions.length) {
      const transaction = transactions[next++]
      let sent = false
      // Persist intent before the request; a lost response may still be admitted.
      try {
        await journal({ status: 'attempting', hash: transaction.hash, nonce: transaction.nonce })
        signal?.throwIfAborted()
        sent = true
        attempted++
        const receipt = await client.submitTransaction(transaction.signed, identity.chainId)
        if (receipt?.status !== 'admitted' || receipt.hash !== transaction.hash || receipt.chainId !== identity.chainId)
          throw new Error('Endpoint returned an invalid admission receipt')
        await journal({ status: 'admitted', hash: transaction.hash, nonce: transaction.nonce })
        admitted++
        if (admitted % 1000 === 0) log(`admitted ${admitted}/${options.count}`)
      } catch (error) {
        failure ??= error
        await journal({ status: sent ? 'unknown' : 'not-sent', hash: transaction.hash, nonce: transaction.nonce,
          error: error instanceof Error ? error.message : String(error) })
      }
    }
  }
  const workers = await Promise.allSettled(Array.from({ length: Math.min(options.concurrency, options.count) }, worker))
  const rejected = workers.find(result => result.status === 'rejected')
  failure ??= rejected?.reason
  const result = { status: failure || signal?.aborted ? 'interrupted' : 'admitted',
    requested: options.count, attempted, admitted, unsent: options.count - attempted, finalized: false }
  await journal(result)
  log(JSON.stringify(result))
  if (failure) throw new Error('Batch stopped; reconcile the journal before retrying. In-flight/unknown transactions may still finalize', { cause: failure })
  signal?.throwIfAborted()
  return result
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args.includes('--interactive')) {
    const interactiveArgs = args.filter(arg => arg !== '--interactive')
    const { validatorPasswordFile } = await import('./validator-config.js')
    const file = validatorPasswordFile(interactiveArgs)
    if (file) process.env.LEOFCOIN_PASSWORD_FILE = file
    const { runCli } = await import('../packages/launch-chain/exports/cli.js')
    await runCli(['batch', ...interactiveArgs])
    return
  }
  const options = parseBatchOptions(args)
  if (options.help) { console.log(help); return }
  let file
  const controller = new AbortController()
  const stop = () => controller.abort(new Error('Batch interrupted by signal'))
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  let tail = Promise.resolve()
  try {
    if (options.confirm) file = await open(options.output, 'wx', 0o600)
    const journal = file ? value => {
      tail = tail.then(async () => { await file.writeFile(JSON.stringify(value) + '\n'); await file.sync() })
      return tail
    } : undefined
    await runBatch(options, { journal, signal: controller.signal })
  } finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
    await file?.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`testnet:batch: ${error.message}`)
    if (error.cause) console.error(`cause: ${error.cause.message}`)
    process.exitCode = 1
  })
}
