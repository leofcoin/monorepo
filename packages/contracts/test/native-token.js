import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import Leofcoin from './../exports/native-token.js'

describe('Leofcoin', () => {
  let token
  const receiverAddress = '0xReceiverAddress'
  const otherReceiverAddress = '0xOtherReceiverAddress'
  const ownerAddress = '0xOwnerAddress'

  beforeEach(() => {
    global.msg = {
      sender: ownerAddress,
      contract: '0xContractAddress',
      staticCall: async (currency, method, args) => {
        // Mock implementation of msg.staticCall
      },
      call: async (currency, method, args) => {
        // Mock implementation of msg.call
      }
    }

    token = new Leofcoin()
  })

  it('should create an instance of Leofcoin', () => {
    assert.ok(token instanceof Leofcoin)
  })

  it('should have correct properties', () => {
    assert.equal(token.name, 'Leofcoin')
    assert.equal(token.symbol, 'LFC')
    assert.equal(token.decimals, 18)
  })

  it('should grant MINT role to owner', async () => {
    await token.grantRole(ownerAddress, 'MINT')
    assert.equal(await token.hasRole(ownerAddress, 'MINT'), true)
  })

  it('should be able to mint', async () => {
    await token.grantRole(ownerAddress, 'MINT')
    await token.mint(ownerAddress, 100000n)
    assert.equal(token.balanceOf(ownerAddress), 100000n)
  })

  it('should be able to transfer', async () => {
    await token.grantRole(ownerAddress, 'MINT')
    await token.mint(receiverAddress, 100000n)
    msg.sender = receiverAddress
    await token.transfer(receiverAddress, otherReceiverAddress, 10000n)
    assert.equal(token.balanceOf(receiverAddress), 90000n)
    assert.equal(token.balanceOf(otherReceiverAddress), 10000n)
  })

  it('should be able to burn', async () => {
    await token.grantRole(ownerAddress, 'BURN')
    await token.grantRole(ownerAddress, 'MINT')
    await token.mint(ownerAddress, 100000n)
    await token.burn(ownerAddress, 10000n)
    assert.equal(token.balanceOf(ownerAddress), 90000n)
  })

  it('should not be able to burn more than balance', async () => {
    await token.grantRole(ownerAddress, 'MINT')
    await token.grantRole(ownerAddress, 'BURN')
    await token.mint(ownerAddress, 100000n)

    await assert.rejects(async () => await token.burn(ownerAddress, 100001n), {
      message: 'amount exceeds balance'
    })
  })

  it('should not be able to mint if not MINT role', async () => {
    assert.throws(() => token.mint(ownerAddress, 100000n), { message: 'not allowed' })
  })

  it('should not be able to transfer more than balance', async () => {
    await token.grantRole(ownerAddress, 'MINT')
    await token.mint(receiverAddress, 100000n)
    msg.sender = receiverAddress
    assert.throws(() => token.transfer(receiverAddress, otherReceiverAddress, 100001n), {
      message: 'amount exceeds balance'
    })
  })
})
