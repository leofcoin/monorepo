import { Storage } from '@leofcoin/storage'
import { base58String } from '@vandeurenglenn/base58'

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

export declare type BlockInMemory = {
  index: number
  transactions: RawTransaction[]
  loaded?: Boolean
}

export declare type RawBlock = {
  index: number
  transactions: RawTransaction[]
}

export declare type ChainConfig = {
  resolveTimeout?: number
}
