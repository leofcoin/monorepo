import './../gpu/ArteonGPU.sol';

contract ArteonGPUARTX1000 is ArteonGPU {
  constructor() ArteonGPU('https://nft.arteon.org/json/artx1000.json', 400, 'ARTX 1000') {}
}
