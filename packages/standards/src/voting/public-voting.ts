import Meta, { MetaState } from '../meta.js'

export interface VotingState extends MetaState {
  votes: {
    [id: string]: Vote
  }
  votingDisabled: boolean
  votingDuration: number
  voteNonce: bigint
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

/**
 * allows everybody that has a balance greater or equal to tokenAmountToReceive to vote
 */
export default class PublicVoting extends Meta {
  #votes: VotingState['votes']
  #votingDisabled: boolean
  #votingDuration: number = 172800000
  #voteNonce: bigint

  constructor(state: VotingState) {
    super(state)
    if (state) {
      this.#votes = state.votes
      this.#votingDisabled = state.votingDisabled
      this.#voteNonce = BigInt(state.voteNonce ?? Object.keys(state.votes ?? {}).length)
    } else {
      this.#votes = {}
      this.#votingDisabled = false
      this.#voteNonce = 0n
    }
  }

  get votes() {
    return { ...this.#votes }
  }

  get votingDuration() {
    return this.#votingDuration
  }

  get votingDisabled() {
    return this.#votingDisabled
  }

  /**
   *
   */
  get state() {
    return {
      ...super.state,
      votes: this.#votes,
      votingDisabled: this.#votingDisabled,
      votingDuration: this.#votingDuration,
      voteNonce: this.#voteNonce
    }
  }

  get inProgress() {
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
    if (!this.#canVote()) throw new Error(`Not allowed to create a vote`)
    const id = (++this.#voteNonce).toString()
    this.#votes[id] = {
      title,
      description,
      method,
      endTime,
      args
    }
  }

  #canVote() {
    // @ts-expect-error
    return this._canVote?.()
  }

  #beforeVote() {
    // @ts-expect-error
    return this._beforeVote?.()
  }

  #endVoting(voteId) {
    let agree = Object.values(this.#votes[voteId].results).filter(
      (result) => result === 1
    )
    let disagree = Object.values(this.#votes[voteId].results).filter(
      (result) => result === 0
    )
    if (agree.length > disagree.length && this.#votes[voteId].enoughVotes)
      this[this.#votes[voteId].method](...this.#votes[voteId].args)
    this.#votes[voteId].finished = true
  }

  async vote(voteId: string, vote: VoteResult) {
    vote = Number(vote) as VoteResult
    if (vote !== 0 && vote !== 0.5 && vote !== 1)
      throw new Error(`invalid vote value ${vote}`)
    if (!this.#votes[voteId]) throw new Error(`Nothing found for ${voteId}`)
    const ended = Date.now() > this.#votes[voteId].endTime
    if (ended && !this.#votes[voteId].finished) this.#endVoting(voteId)
    if (ended) throw new Error('voting already ended')
    if (!this.#canVote()) throw new Error(`Not allowed to vote`)
    await this.#beforeVote()
    this.#votes[voteId][msg.sender] = vote
  }

  #disableVoting() {
    this.#votingDisabled = true
  }

  disableVoting() {
    if (!this.#canVote()) throw new Error('not a allowed')
    else {
      this.createVote(
        `disable voting`,
        `Warning this disables all voting features forever`,
        Date.now() + this.#votingDuration,
        '#disableVoting',
        []
      )
    }
  }

  _sync() {
    for (const vote of this.inProgress) {
      if (vote.endTime < Date.now()) this.#endVoting(vote.id)
    }
  }
}
