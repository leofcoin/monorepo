const test = require('tape')
const Mnemonic = require('./')

const expectedLength = 24

const mnemonicgenerator = new Mnemonic()
let mnemonic
test('can generate', tape => {
  tape.plan(1)
  mnemonic = mnemonicgenerator.generate()
  tape.ok(mnemonic.split(' ').length === expectedLength)
})

test('can seed', tape => {
  tape.plan(1)
  const seed = mnemonicgenerator.seedFromMnemonic(mnemonic)
  tape.ok(seed instanceof Buffer)
})
