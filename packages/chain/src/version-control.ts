import semver from 'semver'
import Contract from './contract.js'
import State from './state.js'

export class VersionControl extends State {
  constructor(config) {
    super(config)
  }
  #currentVersion: string = '1.2.1'
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
       * Note that before v0.2.0 everything gets deleted because of big changes,
       * this is not what we want in the future.
       * In the future we want newer nodes to handle the new changes and still confirm old version transactions
       * Unless there is a security issue!
       * But for now the protocoll isn't finished enough and still has to much breaking changes.
       */
      if (semver.compare('1.2.0', this.version) === 1) {
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
