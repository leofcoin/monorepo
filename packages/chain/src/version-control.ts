import State from './state.js'
import { PROTOCOL_VERSION } from './constants.js'
import { isBlockProtocolCompatible } from './consensus/protocol-version.js'
import type { ChainConfig } from './types.js'

export class VersionControl extends State {
  constructor(config?: ChainConfig) {
    super(config)
    // Startup recovery validates historical blocks before init() returns.
    this.version = PROTOCOL_VERSION
  }
  #currentVersion: string = PROTOCOL_VERSION

  async #setCurrentVersion() {
    this.version = this.#currentVersion
    await globalThis.chainStore.put('version', this.version)
  }
  async init() {
    super.init && (await super.init())

    if (!(await globalThis.chainStore.has('version'))) {
      await this.#setCurrentVersion()
      return
    }
    const storedVersion = new TextDecoder('utf-8', { fatal: true }).decode(await globalThis.chainStore.get('version'))
    if (!isBlockProtocolCompatible(storedVersion, this.#currentVersion))
      throw new Error(`Stored protocol ${storedVersion} is incompatible with ${this.#currentVersion}; explicit ledger migration or testnet reset required`)
    if (storedVersion !== this.#currentVersion) await this.#setCurrentVersion()
  }

  protected isVersionCompatible(peerVersion?: string) {
    return typeof peerVersion === 'string' && typeof this.version === 'string' &&
      isBlockProtocolCompatible(peerVersion, this.version)
  }
}

export default VersionControl
