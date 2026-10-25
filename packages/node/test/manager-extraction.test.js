import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'

test('chain manager is no longer part of the browser node; wallet login remains lazy', () => {
  const shell = readFileSync(new URL('../src/shell.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(shell, /route: 'manager'|applyViewData\('manager'\)/)
  assert.equal(existsSync(new URL('../src/views/manager.ts', import.meta.url)), false)
  assert.match(shell, /if \(needsWallet && !this\.#loginRequested\)/)
  assert.match(shell, /selected === 'manager' \? 'Chain manager is now a separate app.'/)
  const connected = shell.slice(shell.indexOf('async connectedCallback()'), shell.indexOf('disconnectedCallback()'))
  assert.doesNotMatch(connected, /this\.#login\(/)
})
