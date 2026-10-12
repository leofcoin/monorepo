import { decrypt, encrypt } from '@leofcoin/identity-utils'
import base58 from '@vandeurenglenn/base58'
import MultiWallet from '@leofcoin/multi-wallet'
import * as qrcode from 'qrcode'
import QrScanner from 'qr-scanner'

export default class IdentityController {
  #walletInput
  #wallet

  constructor(network, walletInput) {
    this.network = network
    this.#walletInput = walletInput
  }

  /**
   *
   * @param {string} password
   * @param {Number | Boolean} keepUnlocked
   */
  async unlock(password, keepUnlocked = false) {
    try {
      const decrypted = await decrypt(password, base58.decode(this.#walletInput.identity.multiWIF))
      this.#wallet = new MultiWallet(this.network)
      await this.#wallet.fromMultiWif(decrypted)
      // if (keepUnlocked) {
      //   setTimeout(() => {
      //     this.#wallet = undefined
      //   }, keepUnlocked)
      // } else {

      // }
    } catch (error) {
      this.#wallet = undefined
      throw new Error('Could not unlock the wallet. Check your password.', { cause: error })
    }
  }

  sign(hash) {
    return this.#wallet.sign(hash)
  }

  async signer(address: string) {
    if (!this.#wallet) throw new Error('Unlock your wallet before signing.')
    const accounts = await this.accounts()
    for (const offset of [1, 0]) {
      for (const [index, [, externalAddress, internalAddress]] of accounts.entries()) {
        if (address !== externalAddress && address !== internalAddress) continue
        const account = this.#wallet.account(index + offset)
        const wallet = address === externalAddress ? await account.external(offset) : await account.internal(offset)
        if ((await wallet.address) === address) return { sign: (hash) => wallet.sign(hash.subarray(0, 32)) }
      }
    }
    throw new Error('Selected account does not belong to the unlocked wallet.')
  }

  async exportQR(password) {
    const exported = await this.export(password)
    return globalThis.navigator
      ? await qrcode.toDataURL(exported)
      : await qrcode.toString(exported, { type: 'terminal' })
  }

  async importQR(image, password) {
    const multiWIF = QrScanner.scanImage(image)
    return this.import(password, multiWIF)
  }

  async export(password) {
    return this.#wallet.export(password)
  }

  async import(password, encrypted) {
    this.#wallet = new MultiWallet(this.network)
    await this.#wallet.import(password, encrypted)
    return this.#wallet
  }

  async accounts() {
    return JSON.parse(await new TextDecoder().decode(await globalThis.walletStore.get('accounts')))
  }
}
