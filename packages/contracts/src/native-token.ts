import Token, { TokenState } from '@leofcoin/standards/token.js'

export default class Leofcoin extends Token {
  constructor(state: TokenState) {
    super('Leofcoin', 'LFC', 18, state)
  }

  burn(from: address, amount: bigint) {
    // Prevent balance underflow when burning
    if (this.balanceOf(from) < amount) throw new Error('amount exceeds balance')
    return super.burn(from, amount)
  }
}
