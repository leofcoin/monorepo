import Meta, { MetaState } from '../meta.js'

export interface VotingState extends MetaState {
  votes: {
    [id: string]: Vote
  }
  votingDisabled: boolean
  votingDuration: number
  voteNonce: bigint
}

export interface PrivateVotingState extends VotingState {
  voters: address[]
}

export type VoteResult = 0 | 0.5 | 1

export type Vote = {
  title: string
  method: string
  args: any[]
  description: string
  endTime: EpochTimeStamp
  results?: { [address: string]: VoteResult }
  finished?: boolean
  enoughVotes?: boolean
}

export interface VoteView extends Vote {
  id: string
}

export default class PrivateVoting extends Meta {
  #voters: PrivateVotingState['voters']
  #votes: PrivateVotingState['votes']
  #votingDisabled: boolean
  #voteNonce: bigint

  constructor(state: PrivateVotingState) {
    super(state)
    if (state) {
      this.#voters = state.voters
      this.#votes = state.votes
      this.#votingDisabled = state.votingDisabled
      this.#voteNonce = BigInt(state.voteNonce ?? Object.keys(state.votes ?? {}).length)
    } else {
      this.#voters = [msg.sender]
      this.#votes = {}
      this.#votingDisabled = false
      this.#voteNonce = 0n
    }
  }

  get votes() {
    return { ...this.#votes }
  }

  get voters() {
    return { ...this.#voters }
  }

  get votingDisabled() {
    return this.#votingDisabled
  }

  /**
   *
   */
  get state(): {} {
    return {
      ...super.state,
      voters: this.#voters,
      votes: this.#votes,
      votingDisabled: this.#votingDisabled,
      voteNonce: this.#voteNonce
    }
  }

  get inProgress(): VoteView[] {
    return Object.entries(this.#votes)
      .filter(([id, vote]) => !vote.finished)
      .map(([id, vote]) => {
        return { ...vote, id }
      })
  }
  /**
   * create vote
   * @param {string} vote
   * @param {string} description
   * @param {number} endTime
   * @param {string} method function to run when agree amount is bigger
   */

  createVote(
    title: string,
    description: string,
    endTime: EpochTimeStamp,
    method: string,
    args: any[] = []
  ) {
    if (!this.canVote(msg.sender))
      throw new Error(`Not allowed to create a vote`)
    const id = (++this.#voteNonce).toString()
    this.#votes[id] = {
      title,
      description,
      method,
      endTime,
      args
    }
  }

  canVote(address: address) {
    return this.#voters.includes(address)
  }

  #enoughVotes(id) {
    return this.#voters.length - 2 <= Object.keys(this.#votes[id]).length
  }

  #endVoting(voteId) {
    let agree = Object.values(this.#votes[voteId].results).filter(
      (result) => result === 1
    )
    let disagree = Object.values(this.#votes[voteId].results).filter(
      (result) => result === 0
    )
    this.#votes[voteId].enoughVotes = this.#enoughVotes(voteId)
    if (agree.length > disagree.length && this.#votes[voteId].enoughVotes)
      this[this.#votes[voteId].method](...this.#votes[voteId].args)
    this.#votes[voteId].finished = true
  }

  vote(voteId: string, vote: VoteResult) {
    vote = Number(vote) as VoteResult
    if (vote !== 0 && vote !== 0.5 && vote !== 1)
      throw new Error(`invalid vote value ${vote}`)
    if (!this.#votes[voteId]) throw new Error(`Nothing found for ${voteId}`)
    const ended = Date.now() > this.#votes[voteId].endTime
    if (ended && !this.#votes[voteId].finished) this.#endVoting(voteId)
    if (ended) throw new Error('voting already ended')
    if (!this.canVote(msg.sender)) throw new Error(`Not allowed to vote`)
    this.#votes[voteId][msg.sender] = vote
    if (this.#enoughVotes(voteId)) {
      this.#endVoting(voteId)
    }
  }

  #disableVoting() {
    this.#votingDisabled = true
    this.#voters = []
  }

  #grantVotingPower(address) {
    this.#voters.push(address)
  }

  #revokeVotingPower(address) {
    this.#voters.splice(this.#voters.indexOf(address))
  }

  disableVoting() {
    if (!this.canVote(msg.sender)) throw new Error('not a allowed')
    if (this.#voters.length === 1) this.#disableVoting()
    else {
      this.createVote(
        `disable voting`,
        `Warning this disables all voting features forever`,
        Date.now() + 172800000,
        '#disableVoting',
        []
      )
    }
  }

  grantVotingPower(address: address, voteId: string) {
    if (this.#voters.length === 1 && this.canVote(msg.sender))
      this.#grantVotingPower(address)
    else {
      this.createVote(
        `grant voting power to ${address}`,
        `Should we grant ${address} voting power?`,
        Date.now() + 172800000,
        '#grantVotingPower',
        [address]
      )
    }
  }

  revokeVotingPower(address: address, voteId: string) {
    if (!this.canVote(msg.sender)) throw new Error('not a allowed to vote')
    if (
      this.#voters.length === 1 &&
      address === msg.sender &&
      !this.#votingDisabled
    )
      throw new Error(
        'only one voter left, disable voting before making this contract voteless'
      )
    if (this.#voters.length === 1) this.#revokeVotingPower(address)
    else {
      this.createVote(
        `revoke voting power for ${address}`,
        `Should we revoke ${address} it's voting power?`,
        Date.now() + 172800000,
        '#revokeVotingPower',
        [address]
      )
    }
  }

  sync() {
    for (const vote of this.inProgress) {
      if (vote.endTime < Date.now()) this.#endVoting(vote.id)
    }
  }
}
