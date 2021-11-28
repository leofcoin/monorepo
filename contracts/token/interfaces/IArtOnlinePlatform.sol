// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IArtOnlinePlatform {
  function mintAsset(address to, uint256 id) external returns (uint256);
  function ownerOf(uint256 id, uint256 tokenId) external view returns (address);
  function safeTransferFrom(
      address from,
      address to,
      uint256 id,
      uint256 amount,
      bytes memory data
  ) external ;
  function safeBatchTransferFrom(
      address from,
      address to,
      uint256[] memory ids,
      uint256[] memory amounts,
      bytes memory data
  ) external ;
}
