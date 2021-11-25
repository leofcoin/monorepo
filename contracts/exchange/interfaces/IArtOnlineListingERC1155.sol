// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IArtOnlineListingERC1155 {
  function initialize(address owner, address contractAddress, uint256 id, uint256 tokenId, uint256 price, address currency) external;
  function id() external returns (uint256);
  function tokenId() external returns (uint256);
  function owner() external returns (address);
  function setOwner(address owner) external;
  function buy(address receiver) external;
  function setPrice(uint256 price) external;
  function price() external returns (uint256);
  function delist() external;
  function list() external;
  function listed() external returns (uint256);
  function isListed() external returns (bool);
  function currency() external view returns (address);
  function setCurrency(address currency_, uint256 price_) external;
}
