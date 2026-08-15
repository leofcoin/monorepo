const blockchainCodecs = [
  {
    name: 'leofcoin-block',
    codec: '0x6c62',
    hashAlg: 'dbl-keccak-512'
  },
  {
    name: 'leofcoin-tx',
    codec: '0x6c74',
    hashAlg: 'dbl-keccak-512'
  },
  {
    name: 'leofcoin-itx',
    codec: '0x6c69',
    hashAlg: 'keccak-512'
  },
  {
    name: 'leofcoin-pr',
    codec: '0x6c70',
    hashAlg: 'keccak-256'
  },
  {
    name: 'contract-message',
    codec: '0x63636d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'transaction-message',
    codec: '0x746d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'raw-transaction-message',
    codec: '0x72746d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'block-message',
    codec: '0x626d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'bw-message',
    codec: '0x62776d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'bw-request-message',
    codec: '0x6277726d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'validator-message',
    codec: '0x766d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'last-block-message',
    codec: '0x6c626d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'last-block-request-message',
    codec: '0x6c62726d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'state-message',
    codec: '0x73746d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'publish-message',
    codec: '0x70626d',
    hashAlg: 'keccak-256'
  }
]

const consensusCodecs = [
  {
    name: 'beacon-activation-message',
    codec: '0x62616d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'beacon-commitment-message',
    codec: '0x62636d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'beacon-share-message',
    codec: '0x62736d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'proposal-message',
    codec: '0x70726d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'prevote-message',
    codec: '0x70766d',
    hashAlg: 'keccak-256'
  },
  {
    name: 'precommit-message',
    codec: '0x7063636d',
    hashAlg: 'keccak-256'
  }
]

const internalCodecs = [
  {
    name: 'pubsub-request',
    codec: '0x70737271',
    hashAlg: 'keccak-256'
  },
  {
    name: 'pubsub-response',
    codec: '0x707372',
    hashAlg: 'keccak-256'
  }
]

const socialCodecs = [
  {
    name: 'chat-message',
    codec: '0x70636d',
    hashAlg: 'dbl-keccak-256'
  }
]

const peernetCodecs = [
  {
    name: 'disco-hash',
    codec: '0x30',
    hashAlg: 'dbl-keccak-256'
  },
  {
    name: 'peernet-peer-response',
    codec: '0x707072',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-peer',
    codec: '0x7070',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-dht',
    codec: '0x706468',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-dht-response',
    codec: '0x706472',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-data',
    codec: '0x706461',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-data-response',
    codec: '0x70646172',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-message',
    codec: '0x706d65',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-ps',
    codec: '0x707073',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-response',
    codec: '0x7072',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-request',
    codec: '0x707271',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-file',
    codec: '0x7066',
    hashAlg: 'keccak-256'
  },
  {
    name: 'peernet-file-response',
    codec: '0x706672',
    hashAlg: 'keccak-256'
  }
]

export type CodecEntry = {
  name: string
  codec: string | number
  hashAlg: string
}

const codecs: CodecEntry[] = [
  ...internalCodecs,
  ...blockchainCodecs,
  ...consensusCodecs,
  ...socialCodecs,
  ...peernetCodecs
]

export default codecs
