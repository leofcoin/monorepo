// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './interfaces/IArteonListing.sol';
import './../../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './../../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './../../node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol';

contract ArteonListing is IArteonListing {
  address public factory;
  address private _owner;
  address private _token;
  address public arteonGPU;
  uint256 public tokenId;
  uint256 private _price;
  bool private _delisted;

  constructor() {
    factory = msg.sender;
  }

  function owner() public view override returns (address) {
    return _owner;
  }

  function buy(address receiver) external override {
    require(msg.sender == factory, 'ArteonListing: NOT_ALLOWED');
    _beforeTransfer(receiver);
    SafeERC20.safeTransferFrom(IERC20(_token), receiver, _owner, _price);
    IERC721(arteonGPU).safeTransferFrom(_owner, receiver, tokenId);
  }

  function _beforeTransfer(address receiver) internal {
    require(IERC721(arteonGPU).ownerOf(tokenId) == _owner, 'ArteonListing: SELLER_DOES_NOT_OWN');
    uint256 balance = IERC20(_token).balanceOf(receiver);
    require(balance >= _price, 'ArteonExchange: NOT_ENOUGH_TOKENS');
  }

  function initialize(address owner_, address token_, address arteonGPU_, uint256 tokenId_, uint256 price_) external override {
    require(msg.sender == factory, 'ArteonListing: NOT_ALLOWED');
    arteonGPU = arteonGPU_;
    tokenId = tokenId_;
    _price = price_;
    _owner = owner_;
    _token = token_;
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
    require(msg.sender == factory, 'ArteonListing: NOT_ALLOWED');
    _delisted = delisted;
  }
}
