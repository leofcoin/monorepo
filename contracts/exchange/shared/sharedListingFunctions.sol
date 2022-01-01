// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import './../interfaces/IArtOnlineListingERC1155.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import './../interfaces/IArtOnlineExchangeFactory.sol';
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import '@openzeppelin/contracts/utils/Address.sol';
import './../interfaces/IWrappedCurrency.sol';
import './../../manage/interfaces/IArtOnlineSplitter.sol';

abstract contract SharedListingFunctions is IArtOnlineListingERC1155 {
  address internal _factory;
  address internal _owner;
  uint256 internal _id;
  address internal _contractAddress;
  uint256 internal _tokenId;
  address internal _currency;
  uint256 private _price;
  uint256 private _listed;
  address internal _splitter;
  event PriceChange(uint256 oldPrice, uint256 newPrice);
  event OwnerChange(address oldOwner, address newOwner);
  event Listed(uint256);

  function _buyWithCurrency(address receiver, uint256 fee, address feeReceiver) internal {
    if (_splitter != address(0)) {
      SafeERC20.safeTransferFrom(IERC20(_currency), receiver, _splitter, _price - fee);
      IArtOnlineSplitter(_splitter).split(_currency, _price - fee);
    } else {
      SafeERC20.safeTransferFrom(IERC20(_currency), receiver, _owner, _price - fee);
    }
    SafeERC20.safeTransferFrom(IERC20(_currency), receiver, feeReceiver, fee);
  }

  function _buyWithNative(address receiver, uint256 fee, address payable feeWallet) internal {
    require(_currency == address(0), 'CURRENCY_NOT_NATIVE');
    require(msg.value >= _price, 'NOT_ENOUGH_COINS');
    uint256 amount = msg.value - fee;
    if (_splitter != address(0)) {
      IArtOnlineSplitter(_splitter).split{value: amount};
    } else {
      address payable wallet = payable(_owner);
      wallet.transfer(amount);
    }
    feeWallet.transfer(fee);
  }

  function _beforeTransfer(address receiver) internal view {
    require(msg.sender != _owner, 'SELLER_OWN');
    uint256 balance = IERC20(_currency).balanceOf(receiver);
    require(balance >= _price, 'NOT_ENOUGH_TOKENS');
  }

  function setPrice(uint256 amount) external override {
    require(msg.sender == _factory, 'NOT_ALLOWED');
    uint256 oldPrice = _price;
    _price = amount;

    emit PriceChange(oldPrice, _price);
  }

  function price() external view override returns (uint256) {
    return _price;
  }

  function tokenId() external view override returns (uint256) {
    return _tokenId;
  }

  function id() external view override returns (uint256) {
    return _id;
  }

  function isListed() external view override returns (bool) {
    return _listed == 0 ? false : true;
  }

  function listed() external view override returns (uint256) {
    return _listed;
  }

  function delist() external override {
    require(msg.sender == _factory, 'NOT_ALLOWED');
    _listed = 0;
    emit Listed(0);
  }

  function list() external override {
    require(msg.sender == _factory, 'NOT_ALLOWED');
    _listed = 1;
    emit Listed(1);
  }

  function factory() external view returns (address) {
    return _factory;
  }

  function owner() external view override returns (address) {
    return _owner;
  }

  function setOwner(address owner_)  external override {
    require(msg.sender == _factory, 'NOT_ALLOWED');
    address oldOwner = _owner;
    _owner = owner_;

    emit OwnerChange(oldOwner, _owner);
  }

  function currency() external view override returns (address) {
    return _currency;
  }

  function contractAddress() external view override returns (address) {
    return _contractAddress;
  }

  function setCurrency(address currency_, uint256 price_) external override {
    require(msg.sender == _factory, 'NOT_ALLOWED');
    _currency = currency_;
    _price = price_;
  }

  function setSplitter(address splitter_) external override {
    require(msg.sender == _factory, 'NOT_ALLOWED');
    _splitter = splitter_;
  }
}
