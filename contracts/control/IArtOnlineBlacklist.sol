// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IArtOnlineBlacklist {
  function blacklist(address account, bool blacklist_) external;
  function blacklisted(address account) external view returns (bool);
}
