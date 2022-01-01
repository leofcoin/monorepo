// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IArtOnlineStaking {
  function totalSupply(address currency_) external view returns (uint256);
  function balanceOf(address currency_, address account) external view returns (uint256);
  function setReleaseTime(uint256 releaseTime_) external;
  function releaseTime() external view returns (uint256);
  function stake(address account, uint256 amount, address) external returns (bytes32);
  function withdraw(address account, bytes32 id) external;
  function holders(address) external returns (address[] memory);
  function readyToRelease(address account, bytes32 id) external view returns (bool);
  function claimed(address account, bytes32 id) external returns (bool);
  function stakeAmount(address account, bytes32 id) external returns (uint256);
  function currency(address account, bytes32 id) external returns (address);
  function stakeIds(address account) external returns (bytes32[] memory);
  function stakeReleaseTime(address account, bytes32 id) external returns (uint256);
}
