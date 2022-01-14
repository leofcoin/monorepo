// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IUpgradeableProxy {
  function setImplementation(address) external;
  function changeManager(address) external;
}
