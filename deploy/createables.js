const CREATEABLES = require('./../build/contracts/Createables.json');
const ethers = require('ethers')

module.exports = async (deployer, addresses, contracts, signer) => {
  if (!addresses.createables) {
    contracts.createables = await deployer.deploy('createables', CREATEABLES)

    // let tx = await contracts.proxyManager.upgrade(addresses.createablesProxy, addresses.createables)
    // await tx.wait()
    //
    // const contract = new ethers.Contract(addresses.createablesProxy, CREATEABLES.abi, signer);
    // tx = await contract.initialize({gasLimit: 21000000})
    // await tx.wait()
  }

  return {contracts, addresses}
}
