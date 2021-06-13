import './../gpu/ArteonGPU.sol';

contract ArteonGPUGenesis is ArteonGPU {
  constructor() ArteonGPU('https://nft.arteon.org/json/genesis.json', 50, 'GENESIS') {}
}
