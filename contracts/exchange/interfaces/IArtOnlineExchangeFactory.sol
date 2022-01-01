// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IArtOnlineExchangeFactory {
  function feeReceiver() external returns (address);
  function fee() external returns (uint256);
  function feeFor(uint256 amount) external returns (uint256);
  function buy(address receiver) external;
  function setPrice(uint256 price) external;
  function getPrice() external returns (uint256);
  function delist() external;
  function list() external;
  function isListed() external returns (bool);
  function listed() external returns (uint256);
  function wrappedCurrency() external returns (address);
  function setWrappedCurrency(address currency) external;
  function setCurrency(address listing, address currency) external;
  function setSplitter(address listing, address splitter) external;
}
