// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './IArteonListing.sol';

interface IArteonAuctionListing is IArteonListing {
  function bid(uint256 amount) external;
  function highestBid() external returns (uint256);
}
