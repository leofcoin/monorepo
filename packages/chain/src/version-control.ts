import semver from 'semver'
import Contract from './contract.js'
import State from './state.js'
import { warn } from 'console'

export class VersionControl extends State {
  constructor(config) {
    super(config)
  }
  #currentVersion: string = '0.1.0'

  #reachedOneZeroZero = false

  async #setCurrentVersion() {
    this.version = this.#currentVersion
    await globalThis.chainStore.put('version', this.version)
  }
  async init() {
    super.init && (await super.init())

    try {
      const version = await globalThis.chainStore.get('version')

      this.version = new TextDecoder().decode(version)
      console.log(this.version, this.#currentVersion)

      /**
       * protocol version control!
       * Note that before v1.2.2 everything gets deleted because of big changes,
       * This will be removed in the future by setting the #reachedOneZeroZero flag to true
       *
       * This is because we are still in development and the protocol is still changing a lot.
       *
       * # this is not what we want in the future.
       * In the future we want newer nodes to handle the new changes and still confirm old version transactions
       * Unless there is a security issue!
       */
      // check if we are above v1.0.0 and if we still not reached v1.0.0
      // if so, clear all data
      // once v1.0.0 is reached this will not run and we can remove this check once every node is above v1.0.0
      warn('the reachedZeroZero flag is set to false, this will clear all data on every start if above v1.0.0')
      if (semver.compare(this.version, '1.0.0') === 1 && !this.#reachedOneZeroZero) {
        warn('clearing all data because we are below v1.0.0')
        await this.clearAll()
      }

      if (semver.compare(this.#currentVersion, this.version) === 1) {
        await this.#setCurrentVersion()
      }
      // if (version)
    } catch (e) {
      console.log(e)

      // await this.clearAll()
      return this.#setCurrentVersion()
    }
  }
}
