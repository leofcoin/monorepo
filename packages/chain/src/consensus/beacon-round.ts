import { fromBase58, toBase58 } from '@vandeurenglenn/typed-array-utils'

import {
  beaconMessage,
  beaconRandomness,
  deriveBeaconPublicShare,
  reconstructBeaconSignature,
  verifyBeaconProof,
  verifyBeaconSignatureShare
} from './beacon.ts'
import {
  beaconEpochGroupPublicKey,
  beaconParticipants,
  canonicalBeaconEpochConfig,
  type BeaconEpochConfig
} from './beacon-epoch.ts'

export type AcceptedBeaconShare = {
  from: string
  participant: bigint
  signature: string
}

export type FinalizedBeaconRound = {
  epoch: bigint
  proof: string
  randomness: string
  round: bigint
  signers: string[]
}

export class BeaconRound {
  readonly epoch: bigint
  readonly round: bigint
  readonly #config: BeaconEpochConfig
  readonly #groupPublicKey: Uint8Array
  readonly #message: Uint8Array
  readonly #participants: Map<string, bigint>
  readonly #publicShares = new Map<string, Uint8Array>()
  readonly #shares = new Map<string, AcceptedBeaconShare>()
  readonly #equivocations = new Map<string, AcceptedBeaconShare[]>()

  constructor(network: string, configInput: BeaconEpochConfig, round: bigint, previousProof: Uint8Array) {
    if (round < 0n || previousProof.length !== 96) throw new Error('invalid beacon round input')
    this.#config = canonicalBeaconEpochConfig(configInput)
    this.epoch = this.#config.epoch
    this.round = round
    this.#participants = beaconParticipants(this.#config.validators)
    this.#groupPublicKey = fromBase58(beaconEpochGroupPublicKey(this.#config))
    this.#message = beaconMessage(network, this.epoch, round, previousProof)
    const dealerCommitments = this.#config.dealers.map(({ commitments }) =>
      commitments.map((commitment) => fromBase58(commitment))
    )
    for (const [validator, participant] of this.#participants) {
      this.#publicShares.set(validator, deriveBeaconPublicShare(participant, dealerCommitments))
    }
  }

  add(share: AcceptedBeaconShare): 'accepted' | 'duplicate' | 'equivocation' | 'invalid' {
    const expectedParticipant = this.#participants.get(share.from)
    if (expectedParticipant === undefined || expectedParticipant !== share.participant || !share.signature)
      return 'invalid'
    const existing = this.#shares.get(share.from)
    if (existing) {
      if (existing.signature === share.signature) return 'duplicate'
      this.#equivocations.set(share.from, [existing, share])
      return 'equivocation'
    }
    let signature: Uint8Array
    try {
      signature = fromBase58(share.signature)
    } catch {
      return 'invalid'
    }
    if (!verifyBeaconSignatureShare(signature, this.#message, this.#publicShares.get(share.from)!)) return 'invalid'
    this.#shares.set(share.from, Object.freeze({ ...share }))
    return 'accepted'
  }

  get ready(): boolean {
    return this.#shares.size >= this.#config.threshold
  }

  finalize(): FinalizedBeaconRound {
    if (!this.ready) throw new Error('beacon round has not reached threshold')
    const shares = [...this.#shares.values()].map(({ participant, signature }) => ({
      participant,
      signature: fromBase58(signature)
    }))
    const proof = reconstructBeaconSignature(shares, this.#config.threshold)
    if (!verifyBeaconProof(proof, this.#message, this.#groupPublicKey)) {
      throw new Error('reconstructed beacon proof does not match the activated group key')
    }
    return Object.freeze({
      epoch: this.epoch,
      round: this.round,
      proof: toBase58(proof),
      randomness: toBase58(beaconRandomness(proof)),
      signers: [...this.#shares.keys()].sort()
    })
  }

  equivocation(validator: string): AcceptedBeaconShare[] | undefined {
    return this.#equivocations.get(validator)
  }
}
