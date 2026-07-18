import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import Factory from './../exports/factory.js'

describe('Factory', () => {
  let factory

  beforeEach(() => {
    global.msg = {
      sender: '0xOwnerAddress',
      contract: '0xContractAddress',
      staticCall: async (currency, method, args) => {
        if (method === 'balanceOf') {
          return BigInt(100000)
        } else if (method === 'creator') {
          return true
        }
      },
      call: async (currency, method, args) => {
        if (method === 'balanceOf') {
          return BigInt(100000)
        } else if (method === 'creator') {
          return true
        }
      }
    }
    factory = new Factory('0xTokenAddress', BigInt(1000))
  })

  it('should throw an error if address is not a contract creator', async () => {
    factory.isCreator = async () => false
    await assert.rejects(async () => await factory.registerContract('0xContractAddress'), {
      message: "You don't own that contract"
    })
  })

  it('should throw an error if balance is too low', async () => {
    global.msg.staticCall = async (currency, method, args) => {
      if (method === 'balanceOf') {
        return BigInt(100) // Balance too low
      } else if (method === 'creator') {
        return true
      } else if (method === 'transfer') {
        throw new Error('amount exceeds balance')
      }
    }
    await assert.rejects(async () => await factory.registerContract('0xContractAddress'), {
      message: 'amount exceeds balance'
    })
  })

  it('should throw an error if contract is already registered', async () => {
    await factory.registerContract('0xContractAddress')
    await assert.rejects(async () => await factory.registerContract('0xContractAddress'), {
      message: 'already registered'
    })
  })

  it('should successfully register a contract', async () => {
    await factory.registerContract('0xContractAddress')

    assert.equal(factory.totalContracts, BigInt(1))
    assert.ok(factory.contracts.includes('0xContractAddress'))
  })
})
