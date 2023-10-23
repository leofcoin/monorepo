export type Address = base58String

export type RawTransaction = {
  to: Address,
  from: Address,
  method: String,
  params: string[],
  nonce: Number,
  timestamp: EpochTimeStamp
}

export interface Transaction extends RawTransaction {
  signature: string
}
