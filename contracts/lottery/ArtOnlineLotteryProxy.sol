// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import './storage/LotteryStorage.sol';

contract ArtOnlineLotteryProxy is TransparentUpgradeableProxy, LotteryStorage {
  constructor(address logic, address admin, bytes memory data) TransparentUpgradeableProxy(logic, admin, data) public {

  }
}
