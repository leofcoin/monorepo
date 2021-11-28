// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IArtOnlineMining {
  function setTax(uint256 tax_) external;
  function tax() external view returns (uint256);
  function mining(uint256 id, uint256 tokenId) external view returns (uint256);
  function getReward(address sender, uint256 id) external;
  function stakeReward(address sender, uint256 id) external returns (bytes32 stakeId);
  function getRewardBatch(address sender, uint256[] memory ids) external;
  function stakeRewardBatch(address sender, uint256[] memory ids) external returns (bytes32[] memory stakeIds);
  function activateGPU(address sender, uint256 id, uint256 tokenId) external;
  function deactivateGPU(address sender, uint256 id, uint256 tokenId) external;
  function activateGPUBatch(address sender, uint256[] memory ids, uint256[] memory amounts) external;
  function deactivateGPUBatch(address sender, uint256[] memory ids, uint256[] memory amounts) external;
  function activateItem(address sender, uint256 id, uint256 itemId, uint256 tokenId) external;
  function deactivateItem(address sender, uint256 id, uint256 itemId, uint256 tokenId) external;
}
