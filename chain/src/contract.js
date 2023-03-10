import Transaction from "./transaction.js";
import { createContractMessage } from '@leofcoin/lib'
import addresses from "@leofcoin/addresses"

/**
 * @extends {Transaction}
 */
export default class Contract extends Transaction {
  constructor() {
    super()
  }

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
  async deployContract(contract, constructorParameters = []) {
    const message = await createContractMessage(peernet.selectedAccount, contract, constructorParameters)
    try {
      await contractStore.put(await message.hash(), message.encoded)
    } catch (error) {
      throw error
    }
    return this.createTransactionFrom(peernet.selectedAccount, addresses.contractFactory, 'registerContract', [await message.hash()])    
  }
  
  async deployContractMessage(message) {

  }

 
}