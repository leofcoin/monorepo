import { Storage } from '@leofcoin/storage'
import { base58String } from '@vandeurenglenn/base58'
import type { BlockMessage } from '@leofcoin/messages'
import type { BinaryFormat } from '@leofcoin/messages'
import type Peernet from '@leofcoin/peernet'

declare var transactionPoolStore: Storage

export type Address = base58String

export type BlockHash = base58String

interface Transaction {
  to: Address
  from: Address
  method: String
  params: string[]
  nonce: Number
}

interface RawTransaction extends Transaction {
  timestamp: Number
}

export interface globalMessage {
  sender: Address
  call: Function
  staticCall: Function
  delegate: Function
  staticDelegate: Function
}

export type BlockInMemory = BlockMessage['decoded'] & {
  hash: string
  loaded?: boolean
}

export type ChainTip = {
  index: number | bigint
  hash: string
  previousHash?: string
  timestamp?: unknown
  validators?: unknown
}

export type ChainPeer = ReturnType<Peernet['getConnection']> & { version?: string }
export type PeerProtocols = Record<string, new (value: object) => BinaryFormat>

export declare type RawBlock = {
  index: number
  hash: string
  transactions: string[]
}

export declare type ChainConfig = {
  genesis?: import('@leofcoin/lib/pq-genesis').PqGenesis
  resolveTimeout?: number
  network?: string
  networkVersion?: string
  stars?: string[]
}
