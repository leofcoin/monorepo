const test = require('tape')
const {ethers, provider, pause, addresses} = require('./helpers/before-test')

test('say hello', async tape => {
  const proxy = new ethers.Contract(addresses.proxy, ABI, provider)
  const result = await proxy.hello()
  tape.ok(result === 'hi')
})
