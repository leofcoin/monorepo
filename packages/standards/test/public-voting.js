import { test } from 'node:test'
import assert from 'node:assert/strict'
import Voting from './../exports/public-voting.js'

globalThis.state = { lastBlock: { timestamp: Date.now() } }

test('PublicVoting - constructor initializes with correct state', () => {
  const state = {
    votes: {},
    votingDisabled: false,
    votingDuration: 172800000
  }
  const voting = new Voting(state)

  assert.deepEqual(voting.votes, {})
  assert.equal(voting.votingDisabled, false)
  assert.equal(voting.votingDuration, 172800000)
})

test('PublicVoting - votingDuration getter returns correct value', () => {
  const state = {
    votes: {},
    votingDisabled: false
  }
  const voting = new Voting(state)

  assert.equal(voting.votingDuration, 172800000)
})

test('PublicVoting - votingDisabled getter returns correct value', () => {
  const state = {
    votes: {},
    votingDisabled: true
  }
  const voting = new Voting(state)

  assert.equal(voting.votingDisabled, true)
})

test('PublicVoting - inProgress returns empty array when no votes', () => {
  const state = {
    votes: {},
    votingDisabled: false
  }
  const voting = new Voting(state)

  assert.deepEqual(voting.inProgress, [])
})

test('PublicVoting - votes getter returns existing votes', () => {
  const voteId = '123e4567-e89b-12d3-a456-426614174000'
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    votes: {
      [voteId]: {
        title: 'Test Vote',
        description: 'A test vote',
        method: 'testMethod',
        endTime: Date.now() + 100000,
        args: [],
        results: {},
        finished: false
      }
    },
    votingDisabled: false
  }
  const voting = new Voting(state)
  const votes = voting.votes

  assert.equal(Object.keys(votes).length, 1)
  assert.equal(votes[voteId].title, 'Test Vote')
  assert.equal(votes[voteId].description, 'A test vote')
  assert.equal(votes[voteId].method, 'testMethod')
})

test('PublicVoting - inProgress returns only unfinished votes', () => {
  const activeVoteId = '123e4567-e89b-12d3-a456-426614174000'
  const finishedVoteId = '987e6543-e21b-12d3-a456-426614174001'
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    votes: {
      [activeVoteId]: {
        title: 'Active Vote',
        description: 'An active vote',
        method: 'testMethod',
        endTime: Date.now() + 100000,
        args: [],
        finished: false
      },
      [finishedVoteId]: {
        title: 'Finished Vote',
        description: 'A finished vote',
        method: 'testMethod',
        endTime: Date.now() - 100000,
        args: [],
        finished: true
      }
    },
    votingDisabled: false
  }
  const voting = new Voting(state)
  const inProgress = voting.inProgress

  assert.equal(inProgress.length, 1)
  assert.equal(inProgress[0].title, 'Active Vote')
  assert.equal(inProgress[0].id, activeVoteId)
})

test('PublicVoting - vote throws error for invalid vote value', async () => {
  const voteId = '123e4567-e89b-12d3-a456-426614174000'
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    votes: {
      [voteId]: {
        title: 'Test Vote',
        description: 'A test vote',
        method: 'testMethod',
        endTime: Date.now() + 100000,
        args: [],
        results: {},
        finished: false
      }
    },
    votingDisabled: false
  }
  const voting = new Voting(state)

  await assert.rejects(async () => voting.vote(voteId, 2), /invalid vote value/)
})

test('PublicVoting - vote throws error for non-existent vote', async () => {
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    votes: {},
    votingDisabled: false
  }
  const voting = new Voting(state)

  await assert.rejects(
    async () => voting.vote('non-existent-id', 1),
    /Nothing found for/
  )
})

test('PublicVoting - vote throws error for ended vote', async () => {
  const voteId = '123e4567-e89b-12d3-a456-426614174000'
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    votes: {
      [voteId]: {
        title: 'Expired Vote',
        description: 'An expired vote',
        method: 'testMethod',
        endTime: Date.now() - 100000, // Already ended
        args: [],
        results: {},
        finished: false
      }
    },
    votingDisabled: false
  }
  const voting = new Voting(state)

  await assert.rejects(
    async () => voting.vote(voteId, 1),
    /voting already ended/
  )
})

test('PublicVoting - vote ending marks vote as finished when time expires', () => {
  const voteId = '123e4567-e89b-12d3-a456-426614174000'
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    votes: {
      [voteId]: {
        title: 'Expired Vote',
        description: 'A vote that should end',
        method: 'testMethod',
        endTime: Date.now() - 100000, // Already ended
        args: [],
        results: {
          '0x1': 0, // disagree
          '0x2': 0, // disagree
          '0x3': 1 // agree
        },
        finished: false,
        enoughVotes: true
      }
    },
    votingDisabled: false
  }
  const voting = new Voting(state)

  // Before sync, should be in progress
  assert.equal(voting.inProgress.length, 1)

  // Run sync to end expired vote
  voting._sync()

  // After sync, should not be in progress anymore
  assert.equal(voting.inProgress.length, 0)
})

test('PublicVoting - _sync ends all expired in-progress votes', () => {
  const expiredVoteId1 = '123e4567-e89b-12d3-a456-426614174000'
  const expiredVoteId2 = '123e4567-e89b-12d3-a456-426614174001'
  const activeVoteId = '123e4567-e89b-12d3-a456-426614174002'

  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    votes: {
      [expiredVoteId1]: {
        title: 'Expired Vote 1',
        description: 'First expired vote',
        method: 'testMethod',
        endTime: Date.now() - 50000,
        args: [],
        results: { '0x1': 1, '0x2': 0 },
        finished: false
      },
      [expiredVoteId2]: {
        title: 'Expired Vote 2',
        description: 'Second expired vote',
        method: 'testMethod',
        endTime: Date.now() - 100000,
        args: [],
        results: { '0x1': 0, '0x2': 0 },
        finished: false
      },
      [activeVoteId]: {
        title: 'Active Vote',
        description: 'Still active vote',
        method: 'testMethod',
        endTime: Date.now() + 100000,
        args: [],
        results: {},
        finished: false
      }
    },
    votingDisabled: false
  }
  const voting = new Voting(state)

  // Before sync, should have 3 in-progress votes
  assert.equal(voting.inProgress.length, 3)

  // Run sync to end expired votes
  voting._sync()

  // After sync, only the active vote should remain in progress
  const inProgress = voting.inProgress
  assert.equal(inProgress.length, 1)
  assert.equal(inProgress[0].id, activeVoteId)

  // Check that expired votes are marked as finished
  const votes = voting.votes
  assert.equal(votes[expiredVoteId1].finished, true)
  assert.equal(votes[expiredVoteId2].finished, true)
  assert.equal(votes[activeVoteId].finished, false)
})

test('PublicVoting - vote ending with more agrees than disagrees', () => {
  const voteId = '123e4567-e89b-12d3-a456-426614174000'
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    votes: {
      [voteId]: {
        title: 'Vote with Majority Agree',
        description: 'Should pass with majority',
        method: 'testMethod',
        endTime: Date.now() - 1000,
        args: ['arg1', 'arg2'],
        results: {
          '0x1': 1, // agree
          '0x2': 1, // agree
          '0x3': 1, // agree
          '0x4': 0, // disagree
          '0x5': 0 // disagree
        },
        finished: false,
        enoughVotes: false // Not enough votes to execute method
      }
    },
    votingDisabled: false
  }
  const voting = new Voting(state)

  // Before sync, vote should be in progress
  assert.equal(voting.inProgress.length, 1)

  // Run sync to trigger vote ending
  voting._sync()

  // After sync, vote should not be in progress
  assert.equal(voting.inProgress.length, 0)
})

test('PublicVoting - vote ending with more disagrees than agrees', async () => {
  const voteId = '123e4567-e89b-12d3-a456-426614174000'
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    votes: {
      [voteId]: {
        title: 'Vote with Majority Disagree',
        description: 'Should not pass',
        method: 'testMethod',
        endTime: Date.now() - 1000,
        args: [],
        results: {
          '0x1': 0, // disagree
          '0x2': 0, // disagree
          '0x3': 0, // disagree
          '0x4': 1, // agree
          '0x5': 1 // agree
        },
        finished: false,
        enoughVotes: true
      }
    },
    votingDisabled: false
  }
  const voting = new Voting(state)

  // Trigger vote ending
  try {
    await voting.vote(voteId, 1)
  } catch (err) {
    // Expected to throw "voting already ended"
  }

  // Verify vote is finished even though it didn't pass
  assert.equal(voting.votes[voteId].finished, true)
})

test('PublicVoting - vote ending without enoughVotes flag does not execute method', async () => {
  const voteId = '123e4567-e89b-12d3-a456-426614174000'
  const state = {
    creator: '0x1234567890123456789012345678901234567890',
    votes: {
      [voteId]: {
        title: 'Vote Without Enough Votes',
        description: 'Has majority but not enough votes',
        method: 'testMethod',
        endTime: Date.now() - 1000,
        args: [],
        results: {
          '0x1': 1, // agree
          '0x2': 0 // disagree
        },
        finished: false,
        enoughVotes: false // Not enough votes to execute
      }
    },
    votingDisabled: false
  }
  const voting = new Voting(state)

  // Trigger vote ending
  try {
    await voting.vote(voteId, 1)
  } catch (err) {
    // Expected to throw "voting already ended"
  }

  // Vote should be marked as finished
  assert.equal(voting.votes[voteId].finished, true)
})
