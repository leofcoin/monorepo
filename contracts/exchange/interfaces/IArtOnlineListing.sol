// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IArtOnlineListing {
  function tokenId() external returns (uint256);
  function owner() external returns (address);
  function setOwner(address owner) external;
  function buy(address receiver) external payable;
  function setPrice(uint256 price) external;
  function price() external returns (uint256);
  function delist() external;
  function list() external;
  function isListed() external returns (bool);
  function listed() external returns (uint256);
  function currency() external view returns (address);
  function setCurrency(address currency_, uint256 price_) external;
  function setSplitter(address splitter) external;
  function splitter() external returns (address);
  function contractAddress() external returns (address);
  // function supportsInterface(bytes4) external returns (bool);
}
