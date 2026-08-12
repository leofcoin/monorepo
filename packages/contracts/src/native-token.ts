import Token, { TokenState } from '@leofcoin/standards/token.js'

interface LeofcoinState extends TokenState { targetSupply: bigint }

export default class Leofcoin extends Token {
  #targetSupply: bigint

  constructor(targetSupply: bigint, state: LeofcoinState) {
    super('Leofcoin', 'LFC', 18, state)
    this.#targetSupply = state ? BigInt(state.targetSupply) : BigInt(targetSupply)
    if (this.#targetSupply <= 0n) throw new Error('target supply must be positive')
    // The machine executes protocol fee burns as the immutable contract creator.
    // Persist this capability in fresh genesis state; restored legacy state is
    // intentionally left untouched and cannot activate fee burning.
    if (!state && !this.hasRole(msg.sender, 'BURN')) this.grantRole(msg.sender, 'BURN')
    if (!state && !this.hasRole(msg.sender, 'MINT')) this.grantRole(msg.sender, 'MINT')
  }

  get targetSupply() { return this.#targetSupply }

  get state(): LeofcoinState { return { ...super.state, targetSupply: this.#targetSupply } as LeofcoinState }

  burn(from: address, amount: bigint) {
    // Prevent balance underflow when burning
    if (this.balanceOf(from) < amount) throw new Error('amount exceeds balance')
    return super.burn(from, amount)
  }
}
