// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './interfaces/IArteonListing.sol';

contract ArteonListing is IArteonListing {
  address public factory;
  address public arteonGPU;
  uint256 public tokenId;
  uint256 private _price;
  bool private _delisted;

  constructor() {
    factory = msg.sender;
  }

  function initialize(address arteonGPU_, uint256 tokenId_, uint256 price_) external override {
    require(msg.sender == factory, 'ArteonListing: NOT_ALLOWED');
    arteonGPU = arteonGPU_;
    tokenId = tokenId_;
    _price = price_;
  }

  function setPrice(uint256 amount) external override {
    require(msg.sender == factory, 'ArteonListing: NOT_ALLOWED');
    _price = amount;
  }

  function getPrice() external view override returns (uint256) {
    return _price;
  }

  function isListed() external view override returns (bool) {
    return _delisted ? false : true;
  }

  function delist(bool delisted) external override {
    _delisted = delisted;
  }
}
