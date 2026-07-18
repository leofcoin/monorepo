import Token, { TokenState } from '@leofcoin/standards/token.js'

export default class Power extends Token {
  constructor(state: TokenState) {
    super('Power', 'PWR', 18, state)
  }
}
