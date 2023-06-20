import test from 'tape'
import Mnemonic from './index.js'

const expectedLength = 47

const mnemonicgenerator = new Mnemonic()
let mnemonic
test('can generate', async tape => {
  tape.plan(1)
  mnemonic = await mnemonicgenerator.generate(512)
  tape.ok(mnemonic.split(' ').length === expectedLength)
})

test('can seed', async tape => {
  tape.plan(1)
  const seed = await mnemonicgenerator.seedFromMnemonic(mnemonic, 'password', 512, 4096)
  tape.ok(seed instanceof ArrayBuffer)
})
