import { randomUUID } from 'node:crypto'
import { mkdir, readFile, open, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { formatUnits } from '@leofcoin/utils'

export class FaucetError extends Error {
  constructor(status, message, retryAfter = 0) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

export class Faucet {
  #records = []
  #queue = Promise.resolve()
  constructor({ ledger, amount, dailyBudget, cooldownMs = 86400000, adapter, now = Date.now }) {
    if (amount <= 0n || dailyBudget < amount || !Number.isSafeInteger(cooldownMs) || cooldownMs < 60000)
      throw new Error('Invalid faucet limits')
    Object.assign(this, { ledger, amount, dailyBudget, cooldownMs, adapter, now })
  }
  async init() {
    await mkdir(dirname(this.ledger), { recursive: true, mode: 0o700 })
    try {
      const data = JSON.parse(await readFile(this.ledger, 'utf8'))
      if (
        data.version !== 1 ||
        !Array.isArray(data.claims) ||
        data.claims.some(
          (claim) =>
            typeof claim.id !== 'string' ||
            typeof claim.address !== 'string' ||
            typeof claim.ip !== 'string' ||
            !Number.isSafeInteger(claim.createdAt) ||
            !['reserved', 'pending', 'confirmed', 'failed'].includes(claim.state) ||
            !/^\d+$/.test(claim.amount) ||
            BigInt(claim.amount) <= 0n ||
            (claim.fee !== undefined && !/^\d+$/.test(claim.fee))
        )
      )
        throw new Error('Invalid faucet ledger')
      this.#records = data.claims
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    return this
  }
  async #persist() {
    const temporary = `${this.ledger}.tmp`
    const file = await open(temporary, 'w', 0o600)
    try {
      await file.writeFile(JSON.stringify({ version: 1, claims: this.#records }))
      await file.sync()
    } finally {
      await file.close()
    }
    await rename(temporary, this.ledger)
    const directory = await open(dirname(this.ledger), 'r')
    try {
      await directory.sync()
    } finally {
      await directory.close()
    }
  }
  #serialized(task) {
    const next = this.#queue.then(task)
    this.#queue = next.catch(() => {})
    return next
  }
  async flush() {
    await this.#queue
  }
  publicClaim(claim) {
    if (!claim) throw new FaucetError(404, 'Claim not found')
    return {
      id: claim.id,
      address: claim.address,
      amount: formatUnits(BigInt(claim.amount)),
      state: claim.state,
      hash: claim.hash || null,
      createdAt: claim.createdAt,
      nextClaimAt: claim.createdAt + this.cooldownMs
    }
  }
  get(id) {
    return this.publicClaim(this.#records.find((record) => record.id === id))
  }
  async status() {
    const health = await this.adapter.health()
    return {
      network: 'leofcoin:peach',
      testnet: true,
      amount: formatUnits(this.amount),
      cooldownMs: this.cooldownMs,
      ready: health.ready,
      account: health.account,
      balance: formatUnits(BigInt(health.balance || 0n))
    }
  }
  claim(address, ip, requestId) {
    return this.#serialized(async () => {
      await this.adapter.validateAddress(address)
      if (requestId) {
        const existing = this.#records.find((record) => record.id === requestId)
        if (existing) {
          if (existing.address !== address) throw new FaucetError(409, 'Claim ID belongs to a different recipient')
          return this.publicClaim(existing)
        }
      }
      const health = await this.adapter.health()
      if (!health.ready)
        throw new FaucetError(503, 'Testnet faucet is not ready. It needs a synced node, peers and funds.')
      const now = this.now()
      const previous = this.#records
        .filter((record) => record.address === address || record.ip === ip)
        .sort((a, b) => b.createdAt - a.createdAt)[0]
      if (previous && now < previous.createdAt + this.cooldownMs)
        throw new FaucetError(
          429,
          'You can request test LFC once per day per address and IP.',
          Math.ceil((previous.createdAt + this.cooldownMs - now) / 1000)
        )
      const spent = this.#records
        .filter((record) => record.createdAt > now - 86400000 && record.state !== 'failed')
        .reduce((total, record) => total + BigInt(record.amount), 0n)
      if (spent + this.amount > this.dailyBudget)
        throw new FaucetError(429, 'The daily faucet budget has been reached.', 3600)
      const quote = await this.adapter.quote?.(address, this.amount)
      const fee = BigInt(quote?.fee || 0n)
      const outstanding = this.#records
        .filter((record) => record.state === 'reserved' || record.state === 'pending')
        .reduce((total, record) => total + BigInt(record.amount) + BigInt(record.fee || 0n), 0n)
      if (BigInt(health.balance || 0n) < outstanding + this.amount + fee)
        throw new FaucetError(503, 'Faucet funds are reserved for pending claims. Wait for confirmation.')
      const record = {
        id: requestId || randomUUID(),
        address,
        ip,
        amount: this.amount.toString(),
        fee: fee.toString(),
        createdAt: now,
        state: 'reserved'
      }
      this.#records.push(record)
      // A reservation is durable BEFORE broadcasting. A crash or timeout cannot
      // erase its rate/budget charge or cause an automatic duplicate payment.
      await this.#persist()
      try {
        const pending = await this.adapter.submit(address, this.amount, quote)
        if (!pending?.hash || !pending.wait || typeof pending.wait.then !== 'function')
          throw new Error('Missing canonical completion handle')
        // A completion may reject while disk IO is still pending. Observe it
        // immediately; persistence failure still requires manual reconciliation.
        Promise.resolve(pending.wait).catch(() => {})
        record.hash = pending.hash
        record.state = 'pending'
        await this.#persist()
        Promise.resolve(pending.wait)
          .then(
            () =>
              this.#serialized(async () => {
                record.state = 'confirmed'
                await this.#persist()
              }),
            () =>
              this.#serialized(async () => {
                record.state = 'failed'
                await this.#persist()
              })
          )
          .catch((error) => this.adapter.reportError?.(error))
      } catch (error) {
        // The node may already have broadcast before an IO error. Keep the
        // reservation for manual reconciliation, never refund and auto-resend.
        this.adapter.reportError?.(error)
        const failure = new FaucetError(
          503,
          'Claim reserved but submission could not be verified. Do not retry; contact the testnet operator.'
        )
        failure.claimId = record.id
        throw failure
      }
      return this.publicClaim(record)
    })
  }
}
