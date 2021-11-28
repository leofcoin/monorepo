// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IArtOnlineStaking {
  function totalSupply() external view returns (uint256);
  function balanceOf(address account) external view returns (uint256);
  function setReleaseTime(uint256 releaseTime_) external;
  function releaseTime() external view returns (uint256);
  function stake(address account, uint256 amount) external returns (bytes32);
  function withdraw(address account, bytes32 id) external;
  function holders() external returns (address[] memory);
  function readyToRelease(address account, bytes32 id) external view returns (bool);
}
