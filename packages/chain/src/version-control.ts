import semver from 'semver'
import Contract from './contract.js'
import State from './state.js'

export class VersionControl extends State {
  constructor() {
    super()
  }

  async init() {
    super.init && (await super.init())
    console.log('init')

    try {
      const version = await globalThis.chainStore.get('version')

      this.version = new TextDecoder().decode(version)
      console.log(this.version)

      /**
       * protocol version control!
       * note v1 and 1.1 delete everything because of big changes, this is not what we want in the future
       * in the future we want newer nodes to handle the new changes and still confirm old version transactions
       * unless there is a security issue!
       */
      if (this.version !== '1.1.1') {
        this.version = '1.1.1'
        await this.clearAll()
        await globalThis.chainStore.put('version', this.version)
      }
      // if (version)
    } catch (e) {
      console.log(e)

      this.version = '1.1.1'
      await this.clearAll()
      await globalThis.chainStore.put('version', this.version)
    }
  }
}
