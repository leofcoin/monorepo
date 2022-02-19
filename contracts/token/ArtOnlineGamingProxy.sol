// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract ArtOnlineGamingProxy is TransparentUpgradeableProxy {
  constructor(address logic, address admin, bytes memory data) TransparentUpgradeableProxy(logic, admin, data) public {

  }
}
