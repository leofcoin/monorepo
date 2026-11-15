import { PROTOCOL_VERSION } from '../constants.js'
import { isBlockProtocolCompatible } from '../consensus/protocol-version.js'
export { PROTOCOL_VERSION }

type ReadStore = { has(key: string): Promise<boolean>; get(key: string): Promise<Uint8Array> }

// Run before bootstrap/state initialization. Never silently relabel or clear an
// existing ledger when adopting incompatible protocol rules.
export const assertHashFormatState = async (chainStore: ReadStore, stateStore?: ReadStore) => {
  if (await chainStore.has('version')) {
    const version = new TextDecoder('utf-8', { fatal: true }).decode(await chainStore.get('version'))
    if (isBlockProtocolCompatible(version, PROTOCOL_VERSION)) return
    throw new Error(`stored protocol ${version} is incompatible with runtime protocol ${PROTOCOL_VERSION}; explicit ledger migration or a testnet reset is required (preserve the wallet identity)`)
  }
  if (await chainStore.has('lastBlock') || await chainStore.has('recoveryTarget') || await stateStore?.has('lastBlock') ||
    await stateStore?.has('checkpoint:0') || await stateStore?.has('checkpoint:1')) {
    throw new Error('existing chainstate has no protocol version; explicit canonical hash migration required')
  }
}
