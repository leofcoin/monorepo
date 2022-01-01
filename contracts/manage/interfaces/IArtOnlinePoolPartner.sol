// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IArtOnlinePoolPartner {
  function POOL_ROLE() external returns (bytes32);

  function name() external returns (string memory);

  function token() external returns (address);

  function setToken(address token_) external;

  function topUp(address sender, uint256 amount) external;

  function drain(address receiver, uint256 amount) external;

  function mint(address receiver, uint256 amount) external;
}
