import assert from 'node:assert/strict'
import test from 'node:test'
import Router, { parseHashRoute, applyRouteParameters } from '../src/router.ts'

const origin = 'https://node.example'
test('payment links parse query data rather than URLPattern syntax', () => {
  const result = parseHashRoute('#!/wallet/pay?to=recipient&protocol=url&network=leofcoin%3Apeach&amount=10000&description=hallo+test', origin)
  assert.equal(result.route, 'wallet')
  assert.deepEqual(result.subroutes, ['pay'])
  assert.deepEqual(result.params, { to: 'recipient', protocol: 'url', network: 'leofcoin:peach', amount: '10000', description: 'hallo test' })
})

test('payment notes and arbitrary-sized amounts survive URLSearchParams round trips', () => {
  const description = 'Thanks + (coffee)? * : {test} / #!/wallet & café ☕'
  const amount = '9007199254740993123456789.123456789012345678'
  const query = new URLSearchParams({ to: 'recipient', description, amount })
  const result = parseHashRoute(`#!/wallet/pay?${query}`, origin)
  assert.equal(result.params.description, description)
  assert.equal(result.params.amount, amount)
  assert.equal(result.params.to, 'recipient')
})

test('hash prefix detection never splits query text containing another hashbang', () => {
  assert.equal(Router.debang('#!/wallet/pay?description=#!/explorer'), 'wallet/pay?description=#!/explorer')
  assert.equal(Router.isbang('#other#!/wallet'), false)
  assert.equal(Router.debang('wallet/pay'), 'wallet/pay')
})

test('wallet routes pass only payment data to the shared request handler', () => {
  let received
  const page = { applyRouteParameters(params) { received = params } }
  const { params } = parseHashRoute('#!/wallet/pay?to=recipient&network=leofcoin%3Amainnet&description=x%2By&innerHTML=bad&wallet=fake&select=no', origin)
  applyRouteParameters(page, 'wallet/pay', params)
  assert.deepEqual(received, { to: 'recipient', description: 'x+y', network: 'leofcoin:mainnet' })
  assert.equal(page.innerHTML, undefined)
  assert.equal(page.wallet, undefined)
})

test('explorer query fields remain strings and cannot overwrite view methods or DOM properties', () => {
  const page = { select() {} }, original = page.select
  const params = Object.fromEntries(new URLSearchParams('selected=block-hash&blockIndex=9007199254740993&blockHash=parent&innerHTML=bad&constructor=bad&__proto__=bad&select=bad'))
  applyRouteParameters(page, 'explorer/transaction', params)
  assert.equal(page.selected, 'block-hash')
  assert.equal(page.blockIndex, '9007199254740993')
  assert.equal(page.blockHash, 'parent')
  assert.equal(page.select, original)
  assert.equal(page.innerHTML, undefined)
  assert.equal(page.constructor, Object)
})

test('unknown routes never inherit parameter rules from Object.prototype', () => {
  for (const path of ['__proto__', 'constructor', 'unknown']) {
    const page = {}
    assert.doesNotThrow(() => applyRouteParameters(page, path, { innerHTML: 'bad', selected: 'bad' }))
    assert.deepEqual(page, {})
  }
})

test('Space invitation routes pass only inert preview data to the chat handler', () => {
  let received
  const page = { applyRouteParameters(params) { received = params } }
  applyRouteParameters(page, 'chat', { invite: 'signed-invitation', wallet: 'fake', connected: 'true', panel: 'manage', innerHTML: 'bad' })
  assert.deepEqual(received, { invite: 'signed-invitation' })
  assert.equal(page.wallet, undefined)
  assert.equal(page.connected, undefined)
})
