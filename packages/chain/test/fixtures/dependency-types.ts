import { BasicInterface, Codec, CodecHash, FormatInterface } from '@leofcoin/codec-format-interface'
import { fromBase58 } from '@vandeurenglenn/typed-array-utils'
import MultiWallet from '@leofcoin/multi-wallet'

const basic = new BasicInterface()
declare const format: InstanceType<typeof FormatInterface>
declare const codec: InstanceType<typeof Codec>
declare const hash: InstanceType<typeof CodecHash>
declare const wallet: MultiWallet

const bytes: Uint8Array = basic.encode({ value: 1 })
const raw: Uint8Array = basic.fromUint8Array(bytes)
const decoded: object | void = format.fromUint8Array(bytes)
const encoded: Uint8Array = codec.encode(1)
const digest: Promise<Uint8Array> = hash.encode(bytes)
const base58: Uint8Array = fromBase58('123')

// @ts-expect-error A codec encodes numeric codec identifiers, not objects.
codec.encode({ value: 1 })
// @ts-expect-error A hash is asynchronous.
const invalid: Uint8Array = hash.encode(bytes)

void [raw, decoded, encoded, digest, base58, wallet, invalid]
