export default class Chain {
  constructor(config?: object)
  ready: Promise<boolean>
  readonly state: { sync: string; chain: string }
  readonly lastBlock: Promise<{ index: number | bigint; hash: string; previousHash: string }>
  readonly validators: string[]
  readonly nativeToken: string
  participate(address: string): Promise<void>
  sendTransaction(transaction: unknown): Promise<unknown>
}
