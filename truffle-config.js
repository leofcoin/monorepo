const HDWalletProvider = require("@truffle/hdwallet-provider");
const dotenv = require('dotenv').config()
const config = dotenv.parsed

module.exports = {
  plugins: ["truffle-contract-size"],
  compilers: {
    solc: {
      version: '0.8.7',
      settings: {
        optimizer: {
          enabled: true,
          runs: 1000000
        },
        // evmVersion: 'berlin'
      }

    }
  },
  networks: {
    'art-ganache': {
      provider: () => new HDWalletProvider({
        privateKeys: [config.TEST_PRIVATEKEY],
        providerOrUrl: 'HTTP://127.0.0.1:1337'
      }),
      network_id: 1337
    },
    'binance-smartchain-testnet': {
      provider: () => new HDWalletProvider({
        privateKeys: [config.TEST_PRIVATEKEY],
        providerOrUrl: 'https://data-seed-prebsc-2-s2.binance.org:8545'
      }),
      network_id: 97
    },
    'binance-smartchain': {
      provider: () => new HDWalletProvider({
        privateKeys: [config.MAIN_PRIVATEKEY],
        providerOrUrl: 'https://bsc-dataseed.binance.org'
      }),
      network_id: 56
    }
  }
};
