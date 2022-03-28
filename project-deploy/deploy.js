import deploy from './src/project-deploy.js'

const network = 'binance-smartchain-testnet';

(async (deployer) => {
  const result = await deploy('contracts/TestContract.sol', ['0x4eCfe05bAe2535f13a92A16E60Be1b68BdEDEDb7'], network)
  console.log(result);
})()
