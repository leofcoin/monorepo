// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IArteonListing {
  function initialize(address arteonGPU, uint256 tokenId, uint256 price) external;
  function setPrice(uint256 price) external;
  function getPrice() external returns (uint256);
  function delist(bool _delisted) external;
  function isListed() external returns (bool);
}
