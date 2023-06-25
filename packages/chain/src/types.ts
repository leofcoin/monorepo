import { storage } from '@leofcoin/storage'



declare var transactionPoolStore: storage

export type Address = base58String

export type BlockHash = base58String


interface Transaction {
  to: Address,
  from: Address,
  method: String,
  params: string[],
  nonce: Number
}

interface RawTransaction extends Transaction {
  timestamp: Number
}

interface globalMessage {
  sender: Address,
  call: Function,
  staticCall: Function,
  delegate: Function,
  staticDelegate: Function
}

export declare type BlockInMemory = {
  index: number
  transactions: RawTransaction[],
  loaded?: Boolean
}

export declare type RawBlock = {
  index: number
  transactions: RawTransaction[]
}