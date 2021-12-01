// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IAccess {
  function grantRole(bytes32, address) external;
  function hasRole(bytes32, address) external returns (bool);
}
