import test from 'tape'
import Mnemonic from './src/mnemonic.js'

const expectedLength = 24

const mnemonicgenerator = new Mnemonic()
let mnemonic
test('can generate', async tape => {
  tape.plan(1)
  mnemonic = await mnemonicgenerator.generate()
  tape.ok(mnemonic.split(' ').length === expectedLength)
})

test('can seed', async tape => {
  tape.plan(1)
  const seed = await mnemonicgenerator.seedFromMnemonic(mnemonic)
  tape.ok(seed instanceof ArrayBuffer)
})
