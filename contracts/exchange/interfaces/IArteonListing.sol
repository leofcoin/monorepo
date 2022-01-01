// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IArteonListing {
  function initialize(address owner_, address token_, address arteonGPU, uint256 tokenId, uint256 price) external;
  function owner() external returns (address);
  function buy(address receiver) external;
  function setPrice(uint256 price) external;
  function getPrice() external returns (uint256);
  function delist(bool _delisted) external;
  function isListed() external returns (bool);
  function tokenId() external returns (uint256);
}
