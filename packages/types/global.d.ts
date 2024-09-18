import { BigNumber } from '@ethersproject/bignumber'
import LeofcoinBlock from './../messages/exports/messages/block.js'
import Peer from '@netpeer/swarm/peer'

declare interface Msg {
  sender: address
  contract: address
  call(contract: address, method: string, parameters: any[]): Promise<any>
  staticCall(contract: address, method: string, parameters?: any[]): Promise<any>
  delegate(contract: address, method: string, parameters: any[]): Promise<any>
  staticDelegate(contract: address, method: string, parameters?: any[]): Promise<any>
}

declare interface State {
  peers: (typeof Peer)[]
  lastBlock: LeofcoinBlock['decoded']
}

declare global {
  const BigNumber: BigNumber
  type BigNumberish = string | number | bigint | BigNumber | ArrayLike<number>
  type address = string
  const msg: Msg
  const state: State
}
