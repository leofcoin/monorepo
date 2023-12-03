import Transaction from './transaction.js'
import { createContractMessage, signTransaction } from '@leofcoin/lib'
import addresses from '@leofcoin/addresses'
import type MultiWallet from '@leofcoin/multi-wallet'
import { RawTransactionMessage } from '@leofcoin/messages'
/**
 * @extends {Transaction}
 */
export default class Contract extends Transaction {
  constructor() {
    super()
  }

  async init() {}

  /**
   *
   * @param {Address} creator
   * @param {String} contract
   * @param {Array} constructorParameters
   * @returns lib.createContractMessage
   */
  async createContractMessage(creator, contract, constructorParameters = []) {
    return createContractMessage(creator, contract, constructorParameters)
  }

  /**
   *
   * @param {Address} creator
   * @param {String} contract
   * @param {Array} constructorParameters
   * @returns {Address}
   */
  async createContractAddress(creator, contract, constructorParameters = []) {
    contract = await this.createContractMessage(creator, contract, constructorParameters)
    return contract.hash()
  }

  /**
   *
   * @param {String} contract
   * @param {Array} parameters
   * @returns
   */
  async deployContract(signer: MultiWallet, contract, constructorParameters = []) {
    const message = await createContractMessage(await signer.address, contract, constructorParameters)
    return this.deployContractMessage(signer, message)
  }

  async deployContractMessage(signer, message) {
    try {
      await globalThis.contractStore.put(await message.hash(), message.encoded)
    } catch (error) {
      throw error
    }
    let transaction = {
      from: await signer.address,
      to: addresses.contractFactory,
      method: 'registerContract',
      params: [await message.hash()]
    }
    transaction = await signTransaction(await this.createTransaction(transaction), signer)
    return this.sendTransaction(transaction)
  }
}
