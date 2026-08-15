import { test } from 'node:test'
import assert from 'node:assert/strict'
import Roles from './../exports/roles.js'

test('Roles - constructor initializes with provided roles', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: {
      OWNER: [],
      MINT: [],
      BURN: []
    }
  }
  const roles = new Roles(state)

  assert(roles.roles)
  assert.deepEqual(roles.roles.OWNER, [])
  assert.deepEqual(roles.roles.MINT, [])
  assert.deepEqual(roles.roles.BURN, [])
})

test('Roles - constructor with state initializes custom roles', () => {
  const state = {
    creator: '0x1',
    roles: {
      admin: ['0x1', '0x2'],
      user: ['0x3']
    }
  }

  const roles = new Roles(state)

  assert.deepEqual(roles.roles.admin, ['0x1', '0x2'])
  assert.deepEqual(roles.roles.user, ['0x3'])
})

test('Roles - constructor throws when roles is not an object', () => {
  const state = {
    creator: '0x1',
    roles: 'invalid'
  }

  assert.throws(() => {
    new Roles(state)
  }, /expected roles to be an object/)
})

test('Roles - hasRole returns true for address with role', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: {
      OWNER: ['0xabc'],
      MINT: ['0xdef', '0x123'],
      BURN: []
    }
  }
  const roles = new Roles(state)

  assert.equal(roles.hasRole('0xabc', 'OWNER'), true)
  assert.equal(roles.hasRole('0xdef', 'MINT'), true)
  assert.equal(roles.hasRole('0x123', 'MINT'), true)
})

test('Roles - hasRole returns false for address without role', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: {
      OWNER: ['0xabc'],
      MINT: [],
      BURN: []
    }
  }
  const roles = new Roles(state)

  assert.equal(roles.hasRole('0xdef', 'OWNER'), false)
  assert.equal(roles.hasRole('0xabc', 'MINT'), false)
  assert.equal(roles.hasRole('0xabc', 'BURN'), false)
})

test('Roles - hasRole returns false for non-existent role', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: {
      OWNER: ['0xabc'],
      MINT: [],
      BURN: []
    }
  }
  const roles = new Roles(state)

  assert.equal(roles.hasRole('0xabc', 'ADMIN'), false)
  assert.equal(roles.hasRole('0xabc', 'NON_EXISTENT'), false)
})

test('Roles - roles getter returns copy of roles', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: {
      OWNER: ['0x1', '0x2'],
      MINT: ['0x3'],
      BURN: []
    }
  }
  const roles = new Roles(state)
  const rolesObj = roles.roles

  assert.deepEqual(rolesObj.OWNER, ['0x1', '0x2'])
  assert.deepEqual(rolesObj.MINT, ['0x3'])
  assert.deepEqual(rolesObj.BURN, [])
})

test('Roles - state getter returns complete state', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    createdAt: Date.now(),
    roles: {
      OWNER: ['0x1'],
      MINT: ['0x2'],
      BURN: []
    }
  }
  const roles = new Roles(state)
  const rolesState = roles.state

  assert(rolesState.creator)
  assert(rolesState.createdAt)
  assert(rolesState.roles)
  assert.deepEqual(rolesState.roles.OWNER, ['0x1'])
  assert.deepEqual(rolesState.roles.MINT, ['0x2'])
})

test('Roles - hasRole with multiple addresses in same role', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: {
      OWNER: [],
      MINT: ['0xa', '0xb', '0xc', '0xd'],
      BURN: []
    }
  }
  const roles = new Roles(state)

  assert.equal(roles.hasRole('0xa', 'MINT'), true)
  assert.equal(roles.hasRole('0xb', 'MINT'), true)
  assert.equal(roles.hasRole('0xc', 'MINT'), true)
  assert.equal(roles.hasRole('0xd', 'MINT'), true)
  assert.equal(roles.hasRole('0xe', 'MINT'), false)
})

test('Roles - constructor with complex role structure', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: {
      OWNER: ['0x1'],
      MINT: ['0x2', '0x3'],
      BURN: ['0x4', '0x5', '0x6'],
      ADMIN: ['0x7'],
      USER: ['0x8', '0x9', '0xa']
    }
  }
  const roles = new Roles(state)

  assert.equal(roles.hasRole('0x1', 'OWNER'), true)
  assert.equal(roles.hasRole('0x2', 'MINT'), true)
  assert.equal(roles.hasRole('0x3', 'MINT'), true)
  assert.equal(roles.hasRole('0x4', 'BURN'), true)
  assert.equal(roles.hasRole('0x7', 'ADMIN'), true)
  assert.equal(roles.hasRole('0x8', 'USER'), true)
  assert.equal(roles.hasRole('0x9', 'USER'), true)
})

test('Roles - hasRole is case-sensitive', () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    roles: {
      OWNER: ['0xabc'],
      owner: ['0xdef']
    }
  }
  const roles = new Roles(state)

  assert.equal(roles.hasRole('0xabc', 'OWNER'), true)
  assert.equal(roles.hasRole('0xabc', 'owner'), false)
  assert.equal(roles.hasRole('0xdef', 'owner'), true)
  assert.equal(roles.hasRole('0xdef', 'OWNER'), false)
})
