import Token, { TokenState } from '@leofcoin/standards/token.js'

export default class Leofcoin extends Token {
  constructor(state: TokenState) {
    super('Leofcoin', 'LFC', 18, state)
    // The machine executes protocol fee burns as the immutable contract creator.
    // Persist this capability in fresh genesis state; restored legacy state is
    // intentionally left untouched and cannot activate fee burning.
    if (!state && !this.hasRole(msg.sender, 'BURN')) this.grantRole(msg.sender, 'BURN')
  }

  burn(from: address, amount: bigint) {
    // Prevent balance underflow when burning
    if (this.balanceOf(from) < amount) throw new Error('amount exceeds balance')
    return super.burn(from, amount)
  }
}
