const ethers = require('ethers')
const Contract = require('./build/contracts/ArteonGPU.json')

const provider = new ethers.providers.JsonRpcProvider('https://kovan.infura.io/v3/1ca30fe698514cf19a5e3e5e5c8334a8', {
  chainId: 42
})
const signer = new ethers.Wallet('78e88fe3ac5d3fc58b4f6494b75748f944085c8f058878a9a9117df1640cdfb8', provider);

const gpus = [
  '0x1E425559252F8C93565577147F625fF3fdCADDF7',
  '0x487A3027EE67b8b1E0Abb74A025F6e1c96cbDa66',
  '0x6891Ab936a6029b334ec573Bc61742532d8b3f7C'
];

console.log(new ethers.utils.BigNumber('6721975')._hex);
(async () => {
  for (let gpu = 1; gpu <= gpus.length; gpu++) {
    const contract = new ethers.Contract(gpus[gpu - 1], Contract.abi, signer);
    const name = await contract.name()
    const symbol = await contract.symbol()
    const cards = 500

    let promises = []
    let nonce;
    for (let card = 1; card <= cards; card++) {
      if (card === 1) {
        const tx = await contract.addCard(signer.address, {gasLimit: new ethers.utils.BigNumber('100000')._hex})
        nonce = tx.nonce
      }
      promises.push(contract.functions.addCard(signer.address, {nonce: nonce+=1}))
    }
    //
    promises = await Promise.all(promises)
    promises = await Promise.all(promises.map(promise => promise.wait()))
    let totalSupply = ethers.utils.formatUnits(await contract.totalSupply(), 0)
    console.log({name, symbol, totalSupply});
  }
})()
