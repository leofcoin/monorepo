import { TokenReceiver } from '@leofcoin/standards'
import { TokenReceiverState } from '@leofcoin/standards/token-receiver'

export interface chatState extends TokenReceiverState {
  nicknames: { [address: string]: string }
}

export default class Chat extends TokenReceiver {
  #name = 'LeofcoinChat'

  #nicknames: chatState['nicknames'] = {}

  constructor(tokenToReceive, tokenAmountToReceive, state) {
    super(tokenToReceive, tokenAmountToReceive, true, state as TokenReceiverState)
    if (state) {
      this.#nicknames = state.nicknames || {}
    }
  }

  async changeNickName(newName: string) {
    await this._canVote()
    await this._payTokenToReceive()
    this.#nicknames[msg.sender] = newName
  }
}
