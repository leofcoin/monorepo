import Token from './../src/interfaces/token'

export default class SimpleToken extends Token {
  constructor() {
    super('SimpleToken', 'SMT', 18)
  }
}
