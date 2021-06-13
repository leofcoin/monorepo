import './../gpu/ArteonGPU.sol';

contract ArteonGPUARTX2000 is ArteonGPU {
  constructor() ArteonGPU('https://nft.arteon.org/json/artx2000.json', 400, 'ARTX 2000') {}
}
