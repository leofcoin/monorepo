import MultiWallet from '@leofcoin/multi-wallet'

export default class Wallet {

  get defaultNetwork() {
    return globalThis.peernet?.network || 'mainnet'
  }

  /**
   * 
   * @param {Object} options {network, privateKey, mnemonic}
   * @param {String} options.network network name
   * @param {String} options.privateKey privateKey
   * @param {String} options.mnemonic mnemonic
   */
  constructor(options = {network: 'leofcoin', privateKey: undefined, mnemonic: undefined}) {
    const {network, privateKey, mnemonic} = options
    this.network = network
    return this.#initWallet(privateKey, mnemonic)
  }

  async #initWallet(privateKey, mnemonic) {
    if (!globalThis.prompt) {
     const prompt = await import('./../node_modules/prompt/lib/prompt')
     globalThis.prompt = async (description) => {
      prompt.start()
      const {password} = await prompt.get(['password'], {description})
      prompt.stop()
      return password
     }
    }
    this.wallet = new MultiWallet(this.network)
    const password = await prompt('password needed to unnlock, recover or generate')
    if (privateKey) this.wallet.load(privateKey, this.network)
    if (mnemonic) this.wallet.recover(mnemonic, password)
    if (!privateKey && !mnemonic) {      
      this.wallet.mnemonic =  await this.wallet.generate(password, this.network)
    }
    return this
  }
}