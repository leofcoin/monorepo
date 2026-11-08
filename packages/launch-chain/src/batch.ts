import { mkdir, open } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { calculateFee, signTransaction } from '@leofcoin/lib'
import { createChainIdentity, verifyChainIdentity } from '@leofcoin/lib/chain-identity'
import addresses from '@leofcoin/addresses'

type SignedTransaction = Awaited<ReturnType<typeof signTransaction>>
type JournalEntry = Record<string, string | number | boolean>
export type BatchJournal = { path: string; append: (entry: JournalEntry) => Promise<void>; close: () => Promise<void> }
export type BatchWallet = {
  account: string
  identity: () => Promise<unknown>
  connected: () => boolean
  balance: () => Promise<bigint>
  nonce: () => Promise<number>
  parseAmount: (value: string) => bigint
  formatAmount: (value: bigint) => string
  sign: (nonce: number, to: string, amount: bigint) => Promise<SignedTransaction>
  submit: (transaction: SignedTransaction) => Promise<{ hash: string; wait: Promise<unknown> }>
}
export type BatchInteraction = {
  question: (prompt: string) => Promise<string>
  log: (message: string) => void
  createJournal?: () => Promise<BatchJournal>
}

const createJournal = async (): Promise<BatchJournal> => {
  const directory = join(homedir(), '.leofcoin', 'batch-receipts')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const path = join(directory, `${Date.now()}-${randomUUID()}.jsonl`)
  const file = await open(path, 'wx', 0o600)
  let tail = Promise.resolve()
  return {
    path,
    append: entry => {
      tail = tail.then(async () => { await file.writeFile(JSON.stringify(entry) + '\n'); await file.sync() })
      return tail
    },
    close: () => file.close()
  }
}

const positiveInteger = (value: string, label: string, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${label} must be a positive integer`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed > maximum) throw new Error(`${label} exceeds ${maximum}`)
  return parsed
}

/** Uses the running node's signer; never starts another node or opens wallet stores. */
export async function interactiveBatch(wallet: BatchWallet, interaction: BatchInteraction) {
  const { question, log } = interaction
  const identity = await verifyChainIdentity(await wallet.identity())
  const expected = await createChainIdentity('leofcoin:peach', addresses)
  if (identity.network !== 'leofcoin:peach' || identity.chainId !== expected.chainId)
    throw new Error('Batch sending is only available on the expected Peach testnet')
  if (!wallet.connected()) throw new Error('Node must be synced and connected before batch sending')
  log(`Testnet batch wallet: ${wallet.account}`)
  log(`Balance: ${wallet.formatAmount(await wallet.balance())} LFC`)
  const count = positiveInteger((await question('Number of transactions [100000]: ')).trim() || '100000', 'count')
  const to = (await question(`Recipient [self: ${wallet.account}]: `)).trim() || wallet.account
  const defaultAmount = wallet.formatAmount(1n)
  const amount = wallet.parseAmount((await question(`LFC per transaction [${defaultAmount}]: `)).trim() || defaultAmount)
  if (amount <= 0n) throw new Error('Amount must be positive')
  const concurrency = positiveInteger((await question('Concurrent submissions [32]: ')).trim() || '32', 'concurrency', 1024)
  log(`${count} transactions to ${to}, ${wallet.formatAmount(amount)} LFC each; concurrency ${concurrency}.`)
  log('Uses your unlocked wallet. Fees apply; admission is not finalization. Only load networks you are permitted to test.')
  if ((await question('Prepare this batch? Type yes: ')).trim().toLowerCase() !== 'yes') {
    log('Batch cancelled; no transactions sent.')
    return
  }
  const startNonce = await wallet.nonce()
  if (!Number.isSafeInteger(startNonce) || startNonce < 0 || !Number.isSafeInteger(startNonce + count))
    throw new Error('Invalid or unsafe nonce range')
  const transactions: SignedTransaction[] = []
  let fees = 0n
  for (let index = 0; index < count; index++) {
    const signed = await wallet.sign(startNonce + index + 1, to, amount)
    fees += BigInt(await calculateFee(signed))
    transactions.push(signed)
    if ((index + 1) % 1000 === 0) log(`Signed ${index + 1}/${count}`)
  }
  // Self-transfers recycle principal, but still need enough for a transfer plus
  // every fee. Fees are not assumed to return as validator rewards.
  const principal = to === wallet.account ? amount : amount * BigInt(count)
  const required = principal + fees
  const balance = await wallet.balance()
  log(`Total fees: ${wallet.formatAmount(fees)} LFC; required balance: ${wallet.formatAmount(required)} LFC.`)
  if (balance < required) throw new Error('Insufficient wallet balance for this batch including fees')
  if ((await question(`Send ${count} testnet transactions now? Type SEND: `)).trim() !== 'SEND') {
    log('Batch cancelled; no transactions sent.')
    return
  }
  if (!wallet.connected()) throw new Error('Node is no longer synced and connected; no transactions sent')
  if (await wallet.nonce() !== startNonce) throw new Error('Wallet nonce changed; no transactions sent. Stop other senders using this wallet')
  if (await wallet.balance() < required) throw new Error('Wallet balance changed; no transactions sent')
  const journal = await (interaction.createJournal ?? createJournal)()
  log(`Receipts: ${journal.path}`)
  let next = 0
  let attempted = 0
  let admitted = 0
  let failed = false
  let failure: unknown
  try {
    await journal.append({ status: 'prepared', account: wallet.account, to, count, amountAtoms: String(amount),
      feeAtoms: String(fees), chainId: identity.chainId, firstNonce: startNonce + 1, lastNonce: startNonce + count })
    const workers = await Promise.allSettled(Array.from({ length: Math.min(count, concurrency) }, async () => {
      while (!failed && next < count) {
        const index = next++
        const nonce = startNonce + index + 1
        let dispatched = false
        try {
          await journal.append({ status: 'attempting', nonce, from: wallet.account, contract: addresses.nativeToken,
            method: 'transfer', to, amountAtoms: String(amount), timestamp: transactions[index].timestamp,
            signature: String(transactions[index].signature) })
          dispatched = true
          attempted++
          const pending = await wallet.submit(transactions[index])
          if (!pending?.hash || !pending.wait || typeof pending.wait.then !== 'function')
            throw new Error('Node returned an invalid admission handle')
          void pending.wait.catch(error => log(`Transaction ${pending.hash} failed after admission: ${String(error)}`))
          await journal.append({ status: 'admitted', nonce, hash: pending.hash })
          admitted++
          if (admitted % 1000 === 0) log(`Admitted ${admitted}/${count}`)
        } catch (error) {
          failed = true
          failure ??= error
          await journal.append({ status: dispatched ? 'unknown' : 'not-sent', nonce,
            error: error instanceof Error ? error.message : String(error) })
        }
      }
    }))
    const rejected = workers.find(result => result.status === 'rejected')
    if (rejected?.status === 'rejected') { failed = true; failure ??= rejected.reason }
    await journal.append({ status: failed ? 'interrupted' : 'admitted', requested: count, attempted,
      admitted, unsent: count - attempted, finalized: false })
    log(`Batch: ${admitted}/${count} admitted; ${count - attempted} unsent. Not a finalization result.`)
    if (failed) throw new Error(`Batch stopped; reconcile ${journal.path} before retrying. Some transactions may still finalize`, { cause: failure })
  } finally {
    await journal.close()
  }
}
