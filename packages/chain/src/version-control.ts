import semver from 'semver'
import Contract from './contract.js'
import State from './state.js'
import { PROTOCOL_VERSION, REACHED_ONE_ZERO_ZERO } from './constants.js'

export class VersionControl extends State {
  constructor(config) {
    super(config)
  }
  #currentVersion: string = PROTOCOL_VERSION

  #reachedOneZeroZero = REACHED_ONE_ZERO_ZERO

  async #setCurrentVersion() {
    this.version = this.#currentVersion
    await globalThis.chainStore.put('version', this.version)
  }
  async init() {
    super.init && (await super.init())

    try {
      const version = await globalThis.chainStore.get('version')

      const storedVersion = new TextDecoder().decode(version)
      console.log(storedVersion, this.#currentVersion)

      // Always use current version, update store if different
      this.version = this.#currentVersion

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
      console.warn('the reachedZeroZero flag is set to false, this will clear all data on every start if above v1.0.0')
      if (semver.compare(storedVersion, '1.0.0') === 1 && !this.#reachedOneZeroZero) {
        console.warn('clearing all data because we are below v1.0.0')
        await this.clearAll()
      }

      if (storedVersion !== this.#currentVersion) {
        console.log(`Version mismatch: stored=${storedVersion}, current=${this.#currentVersion}. Updating...`)
        await globalThis.chainStore.put('version', this.version)
      }
      // if (version)
    } catch (e) {
      console.log(e)

      // await this.clearAll()
      return this.#setCurrentVersion()
    }
  }

  protected isVersionCompatible(peerVersion?: string) {
    if (!peerVersion || !this.version) return false

    const [peerMajor, peerMinor] = peerVersion.split('.')
    const [localMajor, localMinor] = this.version.split('.')

    return peerMajor === localMajor && peerMinor === localMinor
  }
}

export default VersionControl
