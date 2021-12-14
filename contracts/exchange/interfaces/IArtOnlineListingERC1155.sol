// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
import 'contracts/exchange/interfaces/IArtOnlineListing.sol';

interface IArtOnlineListingERC1155 is IArtOnlineListing {
  function id() external returns (uint256);
  function supportsInterface(bytes4) external returns (bool);
}
