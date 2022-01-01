// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IPausable {
  function paused() external returns (bool);
}
