// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract ArtOnlineExchangeFactoryStorage is AccessControl {
  uint256 internal _unlocked = 1;
  address internal _feeReceiver;
  uint256 internal _fee;
  mapping(address => mapping(uint256 => address)) public getListing;
  mapping(address => mapping(uint256 => mapping(uint256 => address))) public getListingERC1155;
  address[] public allListings;
  address[] public listings;
  address[] public listingsERC1155;

  event List(address listing, uint);
  event ListPartner(address listing, uint);
  event Delist(address listing);
  event Sold(address listing);
}
