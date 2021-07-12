const HDWalletProvider = require("@truffle/hdwallet-provider");
const PrivateKeyProvider = require("truffle-privatekey-provider");
const mnemonic = 'onion view mobile torch box weekend town betray intact slam fabric adjust'
module.exports = {
  // plugins: ["truffle-contract-size"],
  compilers: {
    solc: {
      version: '0.8.0',
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
   fork: {
     host: "127.0.0.1",
     port: 7545,
     network_id: "1337"
   },
   mainnet: {
     provider: async () => {
       const { readfile } = require('fs')
       const { promisify } = require('util')
       const read = promisify(readfile)
       // const mnemonic = await read('./.mnemonic')
       const privateKey = await read('./.privateKey')
       return new PrivateKeyProvider(privateKey, 'wss://mainnet.infura.io/ws/v3/1ca30fe698514cf19a5e3e5e5c8334a8')

       // return new HDWalletProvider(mnemonic, 'wss://mainnet.infura.io/ws/v3/1ca30fe698514cf19a5e3e5e5c8334a8')
     },
     network_id: '1'
   },
   test: {
     host: "127.0.0.1",
     port: 7545,
     network_id: "*"
   },
   ropsten: {
     provider: () => new HDWalletProvider(mnemonic, 'wss://ropsten.infura.io/ws/v3/1ca30fe698514cf19a5e3e5e5c8334a8'),
     network_id: '3'
   },
    kovan: {
      provider: () => new HDWalletProvider(mnemonic, 'wss://kovan.infura.io/ws/v3/1ca30fe698514cf19a5e3e5e5c8334a8'),
      network_id: '42'
    },
   wapnet: {
     provider: () => new HDWalletProvider(mnemonic, 'http://127.0.0.1:8545'),
     host: '127.0.0.1',
     port: 8545,
     network_id: 7475,
     gas: 8000000
   }
  }
};
