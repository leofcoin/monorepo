// todo only one star needed, no need to have one for each network
// unless we change anything to the star protocoll
// version diferences should be handled in the chain
// maybe a good way to handle could be in p2pt-swarm

export default {
  leofcoin: {
    mainnet: {
      // ports don't really matter since it is favorable to have it begind a ngninx proxy but if we change something to the proto it's easier maybe?
      port: 44444,
      // todo a versionhash would be nice to have as a double check?
      versionHash: '0',
      // a short description identifying the version
      description: 'Main net current version',
      stars: ['wss://star.leofcoin.org'] // todo webrtc and bittorent stars
    },

    peach: {
      port: 44444,
      description: 'Main testnet: latest step before merging into main',
      versionHash: '1',
      stars: ['wss://star.leofcoin.org'] // todo webrtc and bittorent stars
    }
  }
}
