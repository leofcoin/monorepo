const HDWalletProvider = require("@truffle/hdwallet-provider");
const mnemonic = 'onion view mobile torch box weekend town betray intact slam fabric adjust'
module.exports = {
  // Uncommenting the defaults below
  // provides for an easier quick-start with Ganache.
  // You can also follow this format for other networks;
  // see <http://truffleframework.com/docs/advanced/configuration>
  // for more details on how to specify configuration options!
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
   test: {
     host: "127.0.0.1",
     port: 7545,
     network_id: "*"
   },
    kovan: {
      provider: () => new HDWalletProvider(mnemonic, 'wss://kovan.infura.io/ws/v3/1ca30fe698514cf19a5e3e5e5c8334a8'),
      network_id: '42'
    },
    ropsten: {
      provider: () => new HDWalletProvider(mnemonic, 'wss://ropsten.infura.io/ws/v3/1ca30fe698514cf19a5e3e5e5c8334a8'),
      network_id: '3'
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
