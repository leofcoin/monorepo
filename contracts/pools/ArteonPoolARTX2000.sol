pragma solidity ^0.8.0;

import './../miner/ArteonMiner.sol';

contract ArteonPoolARTX2000 is ArteonMiner {
  constructor(address token, address gpu) ArteonMiner(token, gpu) { }
}
