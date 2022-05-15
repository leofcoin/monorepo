import Token from './../standards/token.js'

export default class Power extends Token {
  constructor(state) {
    super('Power', 'PWR', 18, state)
  }
}
