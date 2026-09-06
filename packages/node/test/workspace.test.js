import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

test('uses the monorepo chain browser bundle', async () => {
  const chainPackage = JSON.parse(await readFile('../chain/package.json', 'utf8'))
  const browserNode = chainPackage.exports['./browser/node'].import

  assert.equal(browserNode, './exports/browser/node-browser.js')
  await access(`../chain/${browserNode}`)

  const login = await readFile('src/screens/login.ts', 'utf8')
  assert.match(login, /import\('\/chain\/node-browser\.js'\)/)
  assert.match(login, /import\('\/chain\/chain\.js'\)/)
})

test('keeps the browser crypto shim inside the node workspace', async () => {
  await access('src/shims/crypto.ts')
})
