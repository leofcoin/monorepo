import semver from 'semver'
import Contract from './contract.js'
import State from './state.js'

export class VersionControl extends State {
  constructor(config) {
    super(config)
  }
  #currentVersion: string = '1.2.0'
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
       * note v1 and 1.1 delete everything because of big changes, this is not what we want in the future
       * in the future we want newer nodes to handle the new changes and still confirm old version transactions
       * unless there is a security issue!
       */
      if (semver.compare('1.1.1', this.version) === 1) {
        await this.clearAll()
      }
      if (semver.compare(this.#currentVersion, this.version) === 1) {
        // await this.clearAll()
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
