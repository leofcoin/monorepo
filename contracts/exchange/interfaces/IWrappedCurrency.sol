// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IWrappedCurrency {
  function deposit() external payable;
  function withdraw() external;
  function approve(address operator, uint amount) external returns (bool);
  function transfer(address receiver, uint amount) external returns (bool);
  function transferFrom(address sender, address receiver, uint amount) external returns (bool);
}
