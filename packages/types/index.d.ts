import { base58String } from '@vandeurenglenn/base58'

export type Address = base58String

export type TransactionHash = base58String

export type RawTransaction = {
  to: Address
  from: Address
  method: String
  params: string[]
  timestamp: EpochTimeStamp
  nonce?: number
  priority?: Boolean
  dependsOn?: TransactionHash[]
}

export interface Transaction extends RawTransaction {
  signature: string
}
