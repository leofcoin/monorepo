import { test } from 'node:test'
import assert from 'node:assert/strict'
import Token from './../exports/token.js'

test('Token - constructor throws when name is undefined', () => {
  assert.throws(() => {
    new Token('', 'MTK', 18, {
      creator: '0x1',
      roles: { OWNER: [], MINT: [], BURN: [] },
      balances: {},
      approvals: {},
      holders: '0',
      totalSupply: '0'
    })
  }, /name undefined/)
})

test('Token - constructor throws when symbol is undefined', () => {
  assert.throws(() => {
    new Token('MyToken', '', 18, {
      creator: '0x1',
      roles: { OWNER: [], MINT: [], BURN: [] },
      balances: {},
      approvals: {},
      holders: '0',
      totalSupply: '0'
    })
  }, /symbol undefined/)
})

test('Token - constructor with state restores token properties', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: { OWNER: [], MINT: [], BURN: [] },
    balances: { '0x1': '1000', '0x2': '500' },
    approvals: { '0x1': { '0x2': '250' } },
    holders: '2',
    totalSupply: '1500'
  }

  const token = new Token('MyToken', 'MTK', 18, state)

  assert.equal(token.totalSupply, 1500n)
  assert.equal(token.holders, 2n)
})

test('Token - constructor with zero balances state', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: { OWNER: [], MINT: [], BURN: [] },
    balances: {},
    approvals: {},
    holders: '0',
    totalSupply: '0'
  }

  const token = new Token('MyToken', 'MTK', 18, state)

  assert.equal(token.totalSupply, 0n)
  assert.equal(token.holders, 0n)
})

test('Token - decimals getter returns correct value', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: { OWNER: [], MINT: [], BURN: [] },
    balances: {},
    approvals: {},
    holders: '0',
    totalSupply: '0'
  }

  const token = new Token('MyToken', 'MTK', 18, state)

  // Decimals default to 18 when state is provided
  assert.equal(token.decimals, 18)
})

test('Token - balances getter returns copy of balances', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: { OWNER: [], MINT: [], BURN: [] },
    balances: { '0x1': '1000', '0x2': '500' },
    approvals: {},
    holders: '2',
    totalSupply: '1500'
  }

  const token = new Token('MyToken', 'MTK', 18, state)
  const balances = token.balances

  assert.equal(balances['0x1'], 1000n)
  assert.equal(balances['0x2'], 500n)
})

test('Token - balanceOf returns balance for specific address', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: { OWNER: [], MINT: [], BURN: [] },
    balances: { '0xabc': '2500', '0xdef': '750' },
    approvals: {},
    holders: '2',
    totalSupply: '3250'
  }

  const token = new Token('MyToken', 'MTK', 18, state)

  assert.equal(token.balanceOf('0xabc'), 2500n)
  assert.equal(token.balanceOf('0xdef'), 750n)
})

test('Token - approvals getter returns approvals object', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: { OWNER: [], MINT: [], BURN: [] },
    balances: {},
    approvals: { '0x1': { '0x2': '100', '0x3': '200' } },
    holders: '0',
    totalSupply: '0'
  }

  const token = new Token('MyToken', 'MTK', 18, state)
  const approvals = token.approvals

  assert.equal(approvals['0x1']['0x2'], 100n)
  assert.equal(approvals['0x1']['0x3'], 200n)
})

test('Token - approved checks if exact amount is approved', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: { OWNER: [], MINT: [], BURN: [] },
    balances: {},
    approvals: { '0xowner': { '0xoperator': '500' } },
    holders: '0',
    totalSupply: '0'
  }

  const token = new Token('MyToken', 'MTK', 18, state)

  assert.equal(token.approved('0xowner', '0xoperator', 500n), true)
  assert.equal(token.approved('0xowner', '0xoperator', 400n), false)
  assert.equal(token.approved('0xowner', '0xoperator', 600n), false)
})

test('Token - state getter returns complete state object', () => {
  const now = Date.now()
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    createdAt: now,
    roles: { OWNER: ['0x1'], MINT: [], BURN: [] },
    balances: { '0x1': '1000' },
    approvals: { '0x1': { '0x2': '250' } },
    holders: '1',
    totalSupply: '1000'
  }

  const token = new Token('MyToken', 'MTK', 18, state)
  const tokenState = token.state

  // Verify state object has expected properties
  assert(tokenState.creator)
  assert(tokenState.createdAt)
  assert.equal(tokenState.totalSupply, 1000n)
  assert.equal(tokenState.holders, 1n)
  assert(tokenState.balances)
  assert(tokenState.approvals)
})

test('Token - constructor with multiple balances updates holders count', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: { OWNER: [], MINT: [], BURN: [] },
    balances: {
      '0x1': '1000',
      '0x2': '500',
      '0x3': '250',
      '0x4': '750'
    },
    approvals: {},
    holders: '4',
    totalSupply: '2500'
  }

  const token = new Token('MyToken', 'MTK', 18, state)

  assert.equal(token.holders, 4n)
  assert.equal(token.totalSupply, 2500n)
})

test('Token - constructor with complex approval state', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: { OWNER: [], MINT: [], BURN: [] },
    balances: { '0x1': '1000', '0x2': '2000' },
    approvals: {
      '0x1': { '0x2': '100', '0x3': '200' },
      '0x2': { '0x1': '500', '0x4': '300' }
    },
    holders: '2',
    totalSupply: '3000'
  }

  const token = new Token('MyToken', 'MTK', 18, state)
  const approvals = token.approvals

  assert.equal(approvals['0x1']['0x2'], 100n)
  assert.equal(approvals['0x1']['0x3'], 200n)
  assert.equal(approvals['0x2']['0x1'], 500n)
  assert.equal(approvals['0x2']['0x4'], 300n)
})
