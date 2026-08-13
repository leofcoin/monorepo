import { sha256 } from '@noble/hashes/sha256'
import { fromBase58, toBase58 } from '@vandeurenglenn/typed-array-utils'

import { deriveBeaconGroupPublicKey } from './beacon.ts'
import { quorumThreshold } from './quorum.ts'

const encoder = new TextEncoder()

export type BeaconEpochDealer = {
  commitments: string[]
  validator: string
}

export type BeaconEpochConfig = {
  dealers: BeaconEpochDealer[]
  epoch: bigint
  threshold: number
  validators: string[]
}

export type BeaconActivationVote = {
  configDigest: string
  epoch: bigint
  from: string
  signature: string
}

const lengthPrefix = (bytes: Uint8Array) => {
  if (bytes.length > 0xffff) throw new Error('beacon config field is too large')
  const output = new Uint8Array(bytes.length + 2)
  new DataView(output.buffer).setUint16(0, bytes.length, false)
  output.set(bytes, 2)
  return output
}

const concatenate = (parts: Uint8Array[]) => {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

const uint64 = (value: bigint) => {
  if (value < 0n || value > 0xffffffffffffffffn) throw new RangeError('beacon epoch is outside uint64')
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, value, false)
  return bytes
}

export const beaconParticipants = (validators: string[]): Map<string, bigint> => {
  const sorted = [...validators].sort()
  if (sorted.length < 2 || new Set(sorted).size !== sorted.length || sorted.some((validator) => !validator)) {
    throw new Error('beacon requires at least two unique validators')
  }
  return new Map(sorted.map((validator, index) => [validator, BigInt(index + 1)]))
}

export const validateBeaconEpochConfig = (config: BeaconEpochConfig): boolean => {
  try {
    if (config.epoch < 0n) return false
    const participants = beaconParticipants(config.validators)
    const validators = [...participants.keys()]
    if (config.threshold !== quorumThreshold(validators.length) || config.dealers.length < config.threshold)
      return false
    const dealers = [...config.dealers].sort((left, right) => left.validator.localeCompare(right.validator))
    if (new Set(dealers.map(({ validator }) => validator)).size !== dealers.length) return false
    return dealers.every(({ validator, commitments }) => {
      if (!participants.has(validator) || commitments.length !== config.threshold) return false
      return commitments.every((commitment) => fromBase58(commitment).length === 48)
    })
  } catch {
    return false
  }
}

export const canonicalBeaconEpochConfig = (config: BeaconEpochConfig): BeaconEpochConfig => {
  if (!validateBeaconEpochConfig(config)) throw new Error('invalid beacon epoch config')
  return {
    epoch: config.epoch,
    threshold: config.threshold,
    validators: [...config.validators].sort(),
    dealers: [...config.dealers]
      .map((dealer) => ({ validator: dealer.validator, commitments: [...dealer.commitments] }))
      .sort((left, right) => left.validator.localeCompare(right.validator))
  }
}

export const encodeBeaconEpochConfig = (input: BeaconEpochConfig): Uint8Array => {
  const config = canonicalBeaconEpochConfig(input)
  const parts = [encoder.encode('leofcoin-beacon-config-v1'), uint64(config.epoch), uint64(BigInt(config.threshold))]
  parts.push(uint64(BigInt(config.validators.length)))
  for (const validator of config.validators) parts.push(lengthPrefix(encoder.encode(validator)))
  parts.push(uint64(BigInt(config.dealers.length)))
  for (const dealer of config.dealers) {
    parts.push(lengthPrefix(encoder.encode(dealer.validator)))
    for (const commitment of dealer.commitments) parts.push(lengthPrefix(fromBase58(commitment)))
  }
  return concatenate(parts)
}

export const beaconEpochDigest = (config: BeaconEpochConfig): string =>
  toBase58(sha256(encodeBeaconEpochConfig(config)))

export const beaconEpochGroupPublicKey = (config: BeaconEpochConfig): string => {
  const canonical = canonicalBeaconEpochConfig(config)
  return toBase58(
    deriveBeaconGroupPublicKey(
      canonical.dealers.map(({ commitments }) => commitments.map((commitment) => fromBase58(commitment)))
    )
  )
}

export class BeaconEpochVotes {
  readonly config: BeaconEpochConfig
  readonly configDigest: string
  readonly #votes = new Map<string, BeaconActivationVote>()
  readonly #equivocations = new Map<string, BeaconActivationVote[]>()

  constructor(config: BeaconEpochConfig) {
    this.config = canonicalBeaconEpochConfig(config)
    this.configDigest = beaconEpochDigest(this.config)
  }

  add(vote: BeaconActivationVote): 'accepted' | 'duplicate' | 'equivocation' | 'invalid' {
    if (
      vote.epoch !== this.config.epoch ||
      !this.config.validators.includes(vote.from) ||
      !vote.signature ||
      vote.configDigest !== this.configDigest
    ) {
      const existing = this.#votes.get(vote.from)
      if (existing && vote.epoch === existing.epoch && vote.configDigest !== existing.configDigest) {
        this.#equivocations.set(vote.from, [existing, vote])
        return 'equivocation'
      }
      return 'invalid'
    }
    const existing = this.#votes.get(vote.from)
    if (existing) return existing.signature === vote.signature ? 'duplicate' : 'equivocation'
    this.#votes.set(vote.from, Object.freeze({ ...vote }))
    return 'accepted'
  }

  get ready(): boolean {
    return this.#votes.size >= this.config.threshold
  }

  certificate(): BeaconActivationVote[] {
    if (!this.ready) throw new Error('beacon epoch does not have a quorum certificate')
    return [...this.#votes.values()].sort((left, right) => left.from.localeCompare(right.from))
  }

  equivocation(validator: string): BeaconActivationVote[] | undefined {
    return this.#equivocations.get(validator)
  }
}
