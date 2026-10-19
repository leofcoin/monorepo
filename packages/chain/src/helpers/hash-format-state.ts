import { PROTOCOL_VERSION } from '../constants.js'
export { PROTOCOL_VERSION }

type ReadStore = { has(key: string): Promise<boolean>; get(key: string): Promise<Uint8Array> }

// Run before bootstrap/state initialization. Never silently relabel or clear an
// existing ledger when adopting a different content-address format.
export const assertHashFormatState = async (chainStore: ReadStore, stateStore?: ReadStore) => {
  if (await chainStore.has('version')) {
    const version = new TextDecoder().decode(await chainStore.get('version'))
    const parsed = /^(\d+)\.(\d+)\.\d+$/.exec(version)
    const current = PROTOCOL_VERSION.split('.')
    if (parsed && parsed[1] === current[0] && parsed[2] === current[1]) return
    throw new Error(`stored protocol ${version} is incompatible with canonical hash protocol ${PROTOCOL_VERSION}; back up existing data and use a separate migrated data root`)
  }
  if (await chainStore.has('lastBlock') || await stateStore?.has('lastBlock')) {
    throw new Error('existing chainstate has no protocol version; explicit canonical hash migration required')
  }
}
