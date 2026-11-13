import Meta, { MetaState } from '@leofcoin/standards/meta.js'

export interface PaymentMandate {
  owner: address
  merchant: address
  perPeriodLimit: bigint
  periodMs: number
  startsAt: number
  expiresAt: number
  totalLimit: bigint
  totalSpent: bigint
  periodIndex: number
  periodSpent: bigint
  revoked: boolean
}

export interface PaymentMandatesState extends MetaState {
  token: address
  nextId: bigint
  mandates: { [id: string]: PaymentMandate }
}

export default class PaymentMandates extends Meta {
  #token: address
  #nextId = 0n
  #mandates: { [id: string]: PaymentMandate } = {}
  #locked = false

  constructor(token: address, state?: PaymentMandatesState) {
    super(state)
    if (typeof token !== 'string' || !token || token !== token.trim())
      throw new Error('invalid token address')
    if (state && state.token !== token) throw new Error('mandate state token mismatch')
    this.#token = token
    if (state) {
      this.#nextId = BigInt(state.nextId)
      this.#mandates = Object.fromEntries(Object.entries(state.mandates).map(([id, mandate]) => [
        id, {
          ...mandate,
          perPeriodLimit: BigInt(mandate.perPeriodLimit),
          totalLimit: BigInt(mandate.totalLimit),
          totalSpent: BigInt(mandate.totalSpent),
          periodSpent: BigInt(mandate.periodSpent)
        }
      ]))
    }
  }

  get token() {
    return this.#token
  }

  get state(): PaymentMandatesState {
    return {
      ...(super.state as MetaState),
      token: this.#token,
      nextId: this.#nextId,
      mandates: Object.fromEntries(Object.entries(this.#mandates).map(([id, mandate]) => [id, { ...mandate }]))
    }
  }

  getMandate(id: bigint): PaymentMandate {
    return { ...this.#get(id) }
  }

  createMandate(
    merchant: address,
    perPeriodLimit: bigint,
    periodMs: number,
    expiresAt: number,
    totalLimit: bigint
  ): bigint {
    this.#assertUnlocked()
    if (typeof merchant !== 'string' || !merchant || merchant !== merchant.trim() || merchant === msg.sender)
      throw new Error('invalid merchant')
    perPeriodLimit = BigInt(perPeriodLimit)
    totalLimit = BigInt(totalLimit)
    if (perPeriodLimit <= 0n || totalLimit <= 0n) throw new Error('mandate limits must be positive')
    if (!Number.isSafeInteger(periodMs) || periodMs <= 0) throw new Error('invalid mandate period')
    const startsAt = Date.now()
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= startsAt) throw new Error('invalid mandate expiry')
    const id = ++this.#nextId
    this.#mandates[id.toString()] = {
      owner: msg.sender, merchant, perPeriodLimit, periodMs, startsAt, expiresAt,
      totalLimit, totalSpent: 0n, periodIndex: 0, periodSpent: 0n, revoked: false
    }
    return id
  }

  revokeMandate(id: bigint) {
    this.#assertUnlocked()
    const mandate = this.#get(id)
    if (msg.sender !== mandate.owner) throw new Error('only the mandate owner may revoke')
    mandate.revoked = true
  }

  async charge(id: bigint, amount: bigint) {
    this.#assertUnlocked()
    this.#locked = true
    try {
      const mandate = this.#get(id)
      if (msg.sender !== mandate.merchant) throw new Error('only the mandate merchant may charge')
      if (mandate.revoked) throw new Error('mandate revoked')
      const now = Date.now()
      if (now < mandate.startsAt || now >= mandate.expiresAt) throw new Error('mandate not active')
      amount = BigInt(amount)
      if (amount <= 0n) throw new Error('charge amount must be positive')
      const periodIndex = Math.floor((now - mandate.startsAt) / mandate.periodMs)
      if (periodIndex < mandate.periodIndex) throw new Error('mandate time moved backwards')
      const periodSpent = periodIndex === mandate.periodIndex ? mandate.periodSpent : 0n
      if (periodSpent + amount > mandate.perPeriodLimit) throw new Error('mandate period limit exceeded')
      if (mandate.totalSpent + amount > mandate.totalLimit) throw new Error('mandate total limit exceeded')

      const key = BigInt(id).toString()
      this.#mandates[key] = {
        ...mandate, periodIndex, periodSpent: periodSpent + amount, totalSpent: mandate.totalSpent + amount
      }
      try {
        await msg.call(this.#token, 'transferFrom', [mandate.owner, mandate.merchant, amount])
      } catch (error) {
        this.#mandates[key] = mandate
        throw error
      }
    } finally {
      this.#locked = false
    }
  }

  #get(id: bigint): PaymentMandate {
    const mandate = this.#mandates[BigInt(id).toString()]
    if (!mandate) throw new Error('mandate not found')
    return mandate
  }

  #assertUnlocked() {
    if (this.#locked) throw new Error('reentrant call')
  }
}
