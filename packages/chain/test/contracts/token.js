const test = require('tape')

const Token = require('./../../dist/token');

class TestToken extends Token {
  constructor() {
    super('token', 'TKN')
  }
}


// const token = new TestToken()

test("can't access private", tape => {
  tape.plan(3)
  token.holders = 5
  token.balances[0] = 100
  token.symbol = 'TTT'
console.log(token.symbol);
  tape.ok(token.symbol === 'TKN', 'symbol')
  tape.ok(Object.keys(token.balances).length === 0, 'balances')
  tape.ok(token.holders === 0, 'holders')
})

// test("transfer", tape => {
//   tape.plan(1)
// console.log(token.balances);
//   try {
//     token.transfer('0', '1', 100)
//   } catch (e) {
// console.log(e);
//   } finally {
//
//   }
//   console.log(token.balances);
//
//   tape.ok(token.balances[1] === 100)
// })

// console.log(new NativeToken());
