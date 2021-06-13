const ethers = require('ethers')
const Contract = require('./build/contracts/Arteon.json')

const provider = new ethers.providers.JsonRpcProvider('https://kovan.infura.io/v3/1ca30fe698514cf19a5e3e5e5c8334a8', {
  chainId: 42
})

const signer = new ethers.Wallet('78e88fe3ac5d3fc58b4f6494b75748f944085c8f058878a9a9117df1640cdfb8', provider);

const contract = new ethers.Contract(Contract.networks[42].address, Contract.abi, signer);
(async () => {
  console.log(contract);
  const name = await contract.name()
  const symbol = await contract.symbol()
  let totalSupply = await contract.totalSupply()
  totalSupply = ethers.utils.formatUnits(totalSupply, 18)
  let minter = await contract.addMinter(signer.address)
  minter = await minter.wait()
  minter = await contract.addMinter('0x888ffb9F4F915C054A2A8Ee2fe57e92110DF51c0')
  minter = await minter.wait()

  minter = await contract.addMinter('0xD8ba9aAa3b1117356ac01D5C5Ff0550A2ED6B4F9')
  minter = await minter.wait()

  minter = await contract.addMinter('0xCA0166f63DA2fcE42A072B8d7Bd3c9d7e07Fa460')
  minter = await minter.wait()
  let mint = await contract.mint('0xCA0166f63DA2fcE42A072B8d7Bd3c9d7e07Fa460', ethers.utils.parseUnits('1000000000000'))
  mint = await mint.wait()
  mint = await contract.mint(signer.address, ethers.utils.parseUnits('10000000000'))
  mint = await mint.wait()

  console.log({name, symbol, totalSupply});
})()
