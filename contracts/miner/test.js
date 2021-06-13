const ethers = require('ethers')
const Contract = require('./build/contracts/ArteonMiner.json')
const ArteonGPU = require('./../gpu/build/contracts/ArteonGPU.json')
const provider = new ethers.providers.JsonRpcProvider('https://kovan.infura.io/v3/1ca30fe698514cf19a5e3e5e5c8334a8', {
  chainId: 42
})

const signer = new ethers.Wallet('78e88fe3ac5d3fc58b4f6494b75748f944085c8f058878a9a9117df1640cdfb8', provider);

const contract = new ethers.Contract(Contract.networks[42].address, Contract.abi, signer);
console.log(contract.address);
const GPU = new ethers.Contract(ArteonGPU.networks[42].address, ArteonGPU.abi, signer);
(async () => {
  // console.log(contract);
  let approve = await GPU.setApprovalForAll(Contract.networks[42].address, true)
  console.log(await approve.wait());
  try {
    let mining = await contract.mine('4', {gasLimit: 500000})
    console.log({mining});
    console.log(await mining.wait());
  } catch (e) {
    console.error(e);
  } finally {

  }
  // setTimeout(async () => {
    // let deactivated = await contract.deactivate_gpu('1')
    // console.log(deactivated);
    // deactivated = await deactivated.wait()
    // console.log(deactivated);
  //   //
  //
  //   // try {
      // let reward = await contract.getReward();
      // console.log(await reward.wait());
  //   // } catch (e) {
  //   //   console.error(e);
  //   // } finally {
  //   //
  //   // }
  // }, 30000);

  // let totalSupply = ethers.utils.formatUnits(await contract.totalSupply(), 0)
  // let minter = await contract.addMinter(signer.address)
  // minter = await minter.wait()

})()
