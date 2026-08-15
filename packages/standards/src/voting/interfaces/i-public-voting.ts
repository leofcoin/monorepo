export interface IPublicVoting {
  _canVote(): Promise<any>
  _beforeVote(): Promise<any>
}
