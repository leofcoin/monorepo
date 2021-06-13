pragma solidity ^0.8.0;

interface IArteonGPU {
  function supplyCap() external returns (uint256);
  function totalSupply() external returns (uint256);
  function addCard(address to) external returns (uint256);
}
