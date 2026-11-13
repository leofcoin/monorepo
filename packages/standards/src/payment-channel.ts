export interface PaymentChannelState {
  chainId: string
  escrow: string
  channelId: string
  token: string
  payer: string
  payee: string
  deposit: bigint
  expiresAt: number
  challengePeriodMs: number
  sequence: bigint
  paid: bigint
}

const DOMAIN = 'leofcoin:payment-channel:unidirectional:v1'
const UINT256_MAX = (1n << 256n) - 1n
const TERMS = [
  'chainId', 'escrow', 'channelId', 'token', 'payer', 'payee',
  'deposit', 'expiresAt', 'challengePeriodMs'
] as const

const validate = (state: PaymentChannelState) => {
  for (const field of ['chainId', 'escrow', 'channelId', 'token', 'payer', 'payee'] as const) {
    const value = state[field]
    if (typeof value !== 'string' || !value || value.length > 512 || value !== value.trim())
      throw new TypeError(`Invalid channel ${field}`)
  }
  if (state.payer === state.payee) throw new Error('Channel participants must differ')
  for (const field of ['deposit', 'sequence', 'paid'] as const) {
    const value = state[field]
    if (typeof value !== 'bigint' || value < 0n || value > UINT256_MAX)
      throw new TypeError(`Invalid channel ${field}`)
  }
  if (state.deposit === 0n || state.paid > state.deposit)
    throw new Error('Channel payment exceeds funded deposit')
  if (state.sequence === 0n && state.paid !== 0n)
    throw new Error('Initial channel state cannot contain a payment')
  for (const field of ['expiresAt', 'challengePeriodMs'] as const)
    if (!Number.isSafeInteger(state[field]) || state[field] <= 0)
      throw new TypeError(`Invalid channel ${field}`)
}

/** Canonical off-chain payload; signatures cover its SHA-256 digest. */
export const encodePaymentChannelState = (state: PaymentChannelState): Uint8Array => {
  validate(state)
  return new TextEncoder().encode(JSON.stringify([
    DOMAIN, state.chainId, state.escrow, state.channelId, state.token,
    state.payer, state.payee, state.deposit.toString(), state.expiresAt,
    state.challengePeriodMs, state.sequence.toString(), state.paid.toString()
  ]))
}

export const assertPaymentChannelTransition = (
  previous: PaymentChannelState,
  next: PaymentChannelState
): void => {
  validate(previous)
  validate(next)
  for (const field of TERMS)
    if (previous[field] !== next[field]) throw new Error(`Channel ${field} cannot change`)
  if (next.sequence <= previous.sequence) throw new Error('Channel sequence must increase')
  if (next.paid < previous.paid) throw new Error('Cumulative channel payment cannot decrease')
}
