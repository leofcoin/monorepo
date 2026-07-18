import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import Validators from '../exports/validators.js'

describe('Validators', () => {
  let validators
  let validatorState
  const tokenAddress = '0xTokenAddress'
  const ownerAddress = '0xOwnerAddress'
  const validatorAddress = '0xValidatorAddress'
  const anotherValidatorAddress = '0xAnotherValidatorAddress'

  beforeEach(() => {
    global.state = {
      peers: [
        [ownerAddress, { bw: { up: 100, down: 100 } }],
        [validatorAddress, { bw: { up: 100, down: 100 } }],
        [anotherValidatorAddress, { bw: { up: 200, down: 200 } }]
      ]
    }
    global.msg = {
      sender: ownerAddress,
      contract: '0xContractAddress',
      staticCall: async (currency, method, args) => {
        if (method === 'balanceOf') {
          if (args[0] === validatorAddress) return BigInt(100000)
          if (args[0] === anotherValidatorAddress) return BigInt(100000)
        }
        return BigInt(0)
      },
      call: async (currency, method, args) => {
        // Mock implementation of msg.call
      }
    }
    validators = new Validators(tokenAddress, validatorState)
  })

  it('should initialize with default values', () => {
    assert.equal(validators.name, 'LeofcoinValidators')
    assert.equal(validators.currency, tokenAddress)
    assert.deepEqual(validators.validators, [ownerAddress])
    assert.equal(validators.totalValidators, 1)
    assert.equal(validators.minimumBalance.toString(), BigInt(50000).toString())
  })

  it('should change currency if sender is owner', () => {
    validators.changeCurrency('0xNewCurrencyAddress')
    assert.equal(validators.currency, '0xNewCurrencyAddress')
  })

  it('should throw error if non-owner tries to change currency', () => {
    global.msg.sender = validatorAddress
    assert.throws(() => validators.changeCurrency('0xNewCurrencyAddress'), {
      message: 'not an owner'
    })
  })

  it('should add a validator if conditions are met', async () => {
    await validators.addValidator(validatorAddress)
    assert.ok(validators.validators.includes(validatorAddress))
    assert.equal(validators.totalValidators, 2)
  })

  it('should throw error if adding an existing validator', async () => {
    await validators.addValidator(validatorAddress)
    await assert.rejects(async () => await validators.addValidator(validatorAddress), {
      message: 'validator already exists'
    })
  })

  it('should throw error if validator balance is too low', async () => {
    global.msg.staticCall = async (currency, method, args) => BigInt(1000)
    await assert.rejects(async () => await validators.addValidator(anotherValidatorAddress), {
      message: 'balance to low! got: 1000 need: 50000'
    })
  })

  it('should remove a validator if conditions are met', async () => {
    await validators.addValidator(validatorAddress)
    await validators.removeValidator(validatorAddress)
    assert.ok(!validators.validators.includes(validatorAddress))
    assert.equal(validators.totalValidators, 1)
  })

  it('should throw error if removing a non-existing validator', async () => {
    await assert.rejects(async () => await validators.removeValidator(validatorAddress), {
      message: 'validator not found'
    })
  })

  it('should shuffle validator correctly', async () => {
    validators.shuffleValidator()
    assert.ok(validators.currentValidator.includes(ownerAddress))
    await validators.removeValidator(ownerAddress)

    global.msg.sender = validatorAddress
    await validators.addValidator(validatorAddress)

    validators.shuffleValidator()
    assert.ok(validators.currentValidator.includes(validatorAddress))
  })

  it('should return the current validator', () => {
    assert.equal(validators.currentValidator, ownerAddress)
  })

  it('should return state correctly', async () => {
    msg.sender = validatorAddress
    await validators.addValidator(validatorAddress)
    validatorState = validators.state
    assert.deepEqual(validatorState.validators, [ownerAddress, validatorAddress])
  })

  it('should restore from state correctly', () => {
    const newValidators = new Validators(tokenAddress, validatorState)
    assert.deepEqual(newValidators.validators, [ownerAddress, validatorAddress])
    assert.equal(newValidators.totalValidators, 2)
  })
})
