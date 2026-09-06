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
      console.log(decrypted)
      this.#wallet = new MultiWallet(this.network)
      this.#wallet.fromMultiWif(decrypted)
      // if (keepUnlocked) {
      //   setTimeout(() => {
      //     this.#wallet = undefined
      //   }, keepUnlocked)
      // } else {

      // }
    } catch (error) {
      document.querySelector('app-shell').notificationController.createNotification({
        title: 'Identity Error',
        message: `couldn't decrypt wallet using given password.`,
        type: 'alert'
      })
      throw error
    }
  }

  sign(hash) {
    return this.#wallet.sign(hash)
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
