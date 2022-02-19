// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IUpgradeableProxy {
  function implementation() external returns (address);
  function admin() external returns (address);
  function changeAdmin(address) external;
  function upgradeTo(address) external;
  function upgradeToAndCall(address, bytes32) external;
}
