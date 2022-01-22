// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface ICreateable {
  function uri(uint256 token) external returns (string memory);
}
