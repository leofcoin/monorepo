// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IArtOnlineStakingInterface {
  function stake(address account, uint256 amount, address) external returns (bytes32);
  function holders(address) external returns (address[] memory);
}
