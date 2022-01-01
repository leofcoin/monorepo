// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import './IArtOnlineListing.sol';

interface IArtOnlineListingERC1155 is IArtOnlineListing {
  function id() external returns (uint256);
  function supportsInterface(bytes4) external returns (bool);
}
